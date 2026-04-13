import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { fetchBotGuilds, fetchUserGuilds, intersectGuilds } from "@/lib/fluxer";
import { listKnownGuildIds, getStaffTotpAuth } from "@/lib/db";
import { readSessionFromRequest } from "@/lib/session";
import { resolveTotpAuthorization } from "@/lib/totp";
import type { DashboardSession, FluxerGuild } from "@/lib/types";

export interface GuildRequestContext {
  session: DashboardSession;
  guild: FluxerGuild;
}

export function jsonError(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export function requireSession(request: NextRequest): DashboardSession | NextResponse {
  const session = readSessionFromRequest(request);
  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  return session;
}

export async function resolveCommonGuilds(session: DashboardSession): Promise<FluxerGuild[]> {
  const userGuilds = await fetchUserGuilds(session.accessToken);

  let botGuilds: FluxerGuild[] = [];
  try {
    botGuilds = await fetchBotGuilds(env.botToken);
  } catch {
    if (env.nodeEnv === "production") {
      throw new Error("Bot guild lookup unavailable.");
    }

    botGuilds = [];
  }

  if (botGuilds.length === 0) {
    if (env.nodeEnv === "production") {
      return [];
    }

    const knownGuildIds = new Set(await listKnownGuildIds());
    return userGuilds
      .filter((guild) => knownGuildIds.has(guild.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  return intersectGuilds(userGuilds, botGuilds);
}

export async function requireGuildContext(request: NextRequest, guildId: string): Promise<GuildRequestContext | NextResponse> {
  const session = requireSession(request);
  if (session instanceof NextResponse) {
    return session;
  }

  let commonGuilds: FluxerGuild[] = [];
  try {
    commonGuilds = await resolveCommonGuilds(session);
  } catch {
    return jsonError("Authorization service unavailable.", 503);
  }

  const guild = commonGuilds.find((item) => item.id === guildId);
  if (!guild) {
    return jsonError("Forbidden: no access to this guild.", 403);
  }

  return { session, guild };
}

export async function requireTotpAuthorization(
  guildId: string,
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const record = await getStaffTotpAuth(guildId, userId);
  const status = resolveTotpAuthorization(record);

  if (!status.enrolled) {
    return {
      ok: false,
      error: "TOTP setup required. Use dashboard TOTP setup first."
    };
  }

  if (!status.authorized) {
    return {
      ok: false,
      error: `TOTP authorization expired. Verify a code again (window ${env.totpAuthWindowDays} days).`
    };
  }

  return { ok: true };
}
