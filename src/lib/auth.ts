import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getGuildProfile } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { fetchFluxerBotGuildIds, fetchFluxerUserGuilds } from "@/lib/fluxer";
import { hasStaffDashboardAccess } from "@/lib/permissions";
import { parseSnowflake } from "@/lib/snowflake";
import { parseSessionToken, SESSION_COOKIE_NAME } from "@/lib/session";
import type { FluxerGuildOAuth, SessionPayload, StaffGuild } from "@/lib/types";

function resolveGuildName(guild: FluxerGuildOAuth, guildId: string): string {
  const raw = typeof guild.name === "string" ? guild.name.trim() : "";
  return raw || `Guild ${guildId}`;
}

function resolveGuildIcon(guild: FluxerGuildOAuth): string | null {
  const raw = typeof guild.icon === "string" ? guild.icon.trim() : "";
  if (!raw) {
    return null;
  }

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw;
  }

  return null;
}

export function getSession(): SessionPayload | null {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  return parseSessionToken(token);
}

export function requireSession(nextPath = "/dashboard"): SessionPayload {
  const session = getSession();
  if (!session) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  return session;
}

export async function getStaffGuilds(session: SessionPayload): Promise<StaffGuild[]> {
  const env = getEnv();

  const [userGuilds, botGuildIds] = await Promise.all([
    fetchFluxerUserGuilds(session.accessToken),
    fetchFluxerBotGuildIds()
  ]);

  const merged = new Map<string, StaffGuild>();

  for (const guild of userGuilds) {
    const guildId = parseSnowflake(guild.id);
    if (!guildId) {
      continue;
    }

    if (!botGuildIds.has(guildId)) {
      continue;
    }

    if (env.fluxerAllowedGuildIds.size > 0 && !env.fluxerAllowedGuildIds.has(guildId)) {
      continue;
    }

    const permissionsRaw = guild.permissions ?? guild.permissions_new ?? "0";
    if (!hasStaffDashboardAccess(permissionsRaw)) {
      continue;
    }

    if (merged.has(guildId)) {
      continue;
    }

    const profile = getGuildProfile(guildId);
    merged.set(guildId, {
      id: guildId,
      name: profile?.display_name ?? resolveGuildName(guild, guildId),
      iconUrl: profile?.icon_url ?? resolveGuildIcon(guild),
      permissions: String(permissionsRaw)
    });
  }

  return Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export async function assertStaffGuildAccess(guildId: string, session: SessionPayload): Promise<StaffGuild> {
  const guilds = await getStaffGuilds(session);
  const match = guilds.find((guild) => guild.id === guildId);
  if (!match) {
    throw new Error("FORBIDDEN");
  }
  return match;
}
