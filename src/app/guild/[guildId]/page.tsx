import { redirect } from "next/navigation";

import GuildConsole from "@/components/GuildConsole";
import { assertStaffGuildAccess, requireSession } from "@/lib/auth";
import {
  getGuildConfig,
  getGuildProfile,
  getRaidGateState,
  listModerationLogs,
  listPendingVerifications,
  listRecentJoinEvents,
  listWarnings
} from "@/lib/db";
import { fetchFluxerGuildRoles } from "@/lib/fluxer";
import { parseSnowflake } from "@/lib/snowflake";
import { listBlacklistedWords } from "@/lib/words";
import type { GuildRole } from "@/lib/types";

type Props = {
  params: {
    guildId: string;
  };
};

export default async function GuildPage({ params }: Props) {
  const guildId = parseSnowflake(params.guildId);
  if (!guildId) {
    redirect("/dashboard");
  }

  const session = requireSession(`/guild/${guildId}`);

  let guildName = String(guildId);
  try {
    const guild = await assertStaffGuildAccess(guildId, session);
    guildName = guild.name;
  } catch {
    redirect("/dashboard");
  }

  const config = getGuildConfig(guildId);
  const profile = getGuildProfile(guildId);
  const raidState = getRaidGateState(guildId);
  const pending = listPendingVerifications(guildId, 20);
  const warnings = listWarnings(guildId, 100);
  const moderationLogs = listModerationLogs(guildId, 100);
  const blacklistedWords = listBlacklistedWords();

  let roles: GuildRole[] = [];
  let rolesError: string | null = null;
  try {
    roles = await fetchFluxerGuildRoles(guildId);
  } catch (error) {
    rolesError = error instanceof Error ? error.message : "Failed to fetch roles";
  }

  const joinEvents = listRecentJoinEvents(guildId, 20);

  return (
    <>
      <section>
        <p className="section-label" style={{ marginBottom: "26px" }}>
          04 / Guild Control
        </p>
        <h1 style={{ fontSize: "clamp(34px, 5vw, 64px)", lineHeight: 1.02, textTransform: "uppercase", marginBottom: "12px" }}>
          {guildName}
        </h1>
        <p className="mono" style={{ color: "var(--muted)" }}>
          Guild ID: {guildId}
        </p>
      </section>

      <hr style={{ border: "none", borderTop: "1px solid var(--border)" }} />

      <GuildConsole
        guildId={guildId}
        initialConfig={config}
        initialProfile={profile}
        initialRaidState={raidState}
        initialPending={pending}
        initialWarnings={warnings}
        initialModerationLogs={moderationLogs}
        initialBlacklistedWords={blacklistedWords}
        initialRoles={roles}
        initialRolesError={rolesError}
      />

      <section className="panel">
        <h2>Recent Join Events</h2>
        {joinEvents.length === 0 ? (
          <p className="muted">No join events recorded yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Risk</th>
                  <th>Level</th>
                  <th>Action</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {joinEvents.map((row) => (
                  <tr key={`${row.user_id}-${row.created_at}`}>
                    <td className="mono">{row.user_id}</td>
                    <td>{row.risk_score.toFixed(3)}</td>
                    <td>{row.risk_level}</td>
                    <td>{row.action}</td>
                    <td className="mono">{row.created_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
