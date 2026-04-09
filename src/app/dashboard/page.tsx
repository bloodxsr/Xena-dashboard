import Link from "next/link";

import { getStaffGuilds, requireSession } from "@/lib/auth";
import type { StaffGuild } from "@/lib/types";

export default async function DashboardPage() {
  const session = requireSession("/dashboard");

  let guilds: StaffGuild[] = [];
  let loadError: string | null = null;
  try {
    guilds = await getStaffGuilds(session);
  } catch (error) {
    console.error("Failed to load staff guilds", error);
    loadError = "Unable to load guild data right now. Your session is still active.";
  }

  return (
    <>
      <section>
        <p className="section-label" style={{ marginBottom: "26px" }}>
          03 / Staff Console
        </p>
        <h1 style={{ fontSize: "clamp(38px, 6vw, 72px)", lineHeight: 1, textTransform: "uppercase", marginBottom: "16px" }}>
          Welcome,
          <br />
          {session.username}
        </h1>
        <p className="muted" style={{ maxWidth: "620px" }}>
          Guilds shown below are filtered by your staff access policy and represent the operational scope you can manage.
        </p>
      </section>

      <hr style={{ border: "none", borderTop: "1px solid var(--border)" }} />

      {loadError ? (
        <section className="panel stack">
          <div className="alert error">{loadError}</div>
          <p className="muted">
            If you are using Fluxer mode, verify DATABASE_PATH points to the bot SQLite file and that the schema is available.
          </p>
          <div className="row">
            <Link className="btn" href="/dashboard">
              Retry
            </Link>
            <Link className="btn alt" href="/logout">
              Sign Out
            </Link>
          </div>
        </section>
      ) : guilds.length === 0 ? (
        <section className="panel">
          <div className="alert warn">No manageable guilds found for this account.</div>
          <p className="muted">You need Administrator, Manage Server, or Moderate Members permission in a guild.</p>
        </section>
      ) : (
        <section className="guild-grid">
          {guilds.map((guild) => (
            <Link className="panel link-hover" key={guild.id} href={`/guild/${guild.id}`}>
              <div className="row" style={{ alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                <div
                  style={{
                    width: "52px",
                    height: "52px",
                    borderRadius: "999px",
                    border: "1px solid var(--border)",
                    background: "#121212",
                    overflow: "hidden",
                    display: "grid",
                    placeItems: "center"
                  }}
                >
                  {guild.iconUrl ? (
                    <img
                      src={guild.iconUrl}
                      alt={`${guild.name} server icon`}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <span className="mono" style={{ fontSize: "12px" }}>
                      {guild.name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>

                <div>
                  <p className="eyebrow" style={{ marginBottom: "6px" }}>
                    Server
                  </p>
                  <h3 style={{ fontSize: "clamp(22px, 3vw, 34px)", lineHeight: 1.1 }}>{guild.name}</h3>
                </div>
              </div>

              <p className="mono" style={{ color: "var(--muted)" }}>
                Open guild console
              </p>
            </Link>
          ))}
        </section>
      )}
    </>
  );
}
