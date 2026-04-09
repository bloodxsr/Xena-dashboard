import { getEnv } from "@/lib/env";
import { parseSnowflake } from "@/lib/snowflake";
import type { FluxerGuildOAuth, FluxerUser, GuildRole } from "@/lib/types";

type FluxerTokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
};

type FluxerMessageLike = {
  id?: string | number | null;
};

function oauthRedirectUri(): string {
  const env = getEnv();
  if (env.fluxerRedirectUri) {
    return env.fluxerRedirectUri;
  }
  return `${env.appBaseUrl}/oauth/callback`;
}

function requireOauthClientConfig(): { clientId: string; clientSecret: string } {
  const env = getEnv();
  const clientId = env.fluxerClientId ?? "";
  const clientSecret = env.fluxerClientSecret ?? "";

  if (!clientId || !clientSecret) {
    throw new Error("Fluxer OAuth client is not configured");
  }

  return { clientId, clientSecret };
}

function requireBotToken(): string {
  const token = getEnv().botToken;
  if (!token) {
    throw new Error("FLUXER_BOT_TOKEN (or BOT_TOKEN) is required for bot control actions");
  }
  return token;
}

function parseApiErrorText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const data = payload as Record<string, unknown>;
  const message = data.message;
  if (typeof message === "string" && message.trim()) {
    return message;
  }

  const description = data.error_description;
  if (typeof description === "string" && description.trim()) {
    return description;
  }

  const error = data.error;
  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return null;
}

async function requestFluxerApi(
  path: string,
  authorization: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const env = getEnv();
  const headers = new Headers(init?.headers ?? {});
  headers.set("Authorization", authorization);

  if (init?.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${env.fluxerApiBase}${path}`, {
    ...init,
    headers,
    cache: "no-store"
  });

  const text = await response.text();
  let body: unknown = null;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    body
  };
}

function auditLogHeaders(reason: string | null | undefined): Record<string, string> {
  const cleaned = String(reason ?? "").trim();
  if (!cleaned) {
    return {};
  }

  return {
    "X-Audit-Log-Reason": encodeURIComponent(cleaned).slice(0, 512)
  };
}

async function requestFluxerBotApi(path: string, init: RequestInit, fallbackMessage: string): Promise<unknown> {
  const token = requireBotToken();
  const response = await requestFluxerApi(path, `Bot ${token}`, init);
  if (!response.ok) {
    const reason = parseApiErrorText(response.body) ?? `${fallbackMessage} (${response.status})`;
    throw new Error(reason);
  }

  return response.body;
}

export function buildFluxerLoginUrl(state: string): string {
  const env = getEnv();
  const { clientId } = requireOauthClientConfig();

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: oauthRedirectUri(),
    scope: env.fluxerOauthScope,
    state
  });

  return `${env.fluxerWebBase}/oauth2/authorize?${params.toString()}`;
}

export async function exchangeFluxerCode(code: string): Promise<FluxerTokenResponse> {
  const env = getEnv();
  const { clientId, clientSecret } = requireOauthClientConfig();

  const payload = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: oauthRedirectUri(),
    code
  });

  const response = await fetch(`${env.fluxerApiBase}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: payload,
    cache: "no-store"
  });

  const text = await response.text();
  let body: unknown = null;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    const reason = parseApiErrorText(body) ?? `OAuth token exchange failed (${response.status})`;
    throw new Error(reason);
  }

  const token = body as FluxerTokenResponse | null;
  if (!token || typeof token.access_token !== "string" || !token.access_token.trim()) {
    throw new Error("Fluxer token response did not include access_token");
  }

  return token;
}

export async function fetchFluxerUser(accessToken: string): Promise<FluxerUser> {
  const response = await requestFluxerApi("/users/@me", `Bearer ${accessToken}`);
  if (!response.ok) {
    const reason = parseApiErrorText(response.body) ?? `Failed to fetch Fluxer user (${response.status})`;
    throw new Error(reason);
  }

  return (response.body ?? {}) as FluxerUser;
}

async function fetchGuildsWithAuthorization(authorization: string): Promise<FluxerGuildOAuth[]> {
  const response = await requestFluxerApi("/users/@me/guilds", authorization);
  if (!response.ok) {
    const reason = parseApiErrorText(response.body) ?? `Failed to fetch Fluxer guilds (${response.status})`;
    throw new Error(reason);
  }

  if (!Array.isArray(response.body)) {
    return [];
  }

  return response.body as FluxerGuildOAuth[];
}

export async function fetchFluxerUserGuilds(accessToken: string): Promise<FluxerGuildOAuth[]> {
  return fetchGuildsWithAuthorization(`Bearer ${accessToken}`);
}

export async function fetchFluxerBotGuildIds(): Promise<Set<string>> {
  const token = requireBotToken();

  const guilds = await fetchGuildsWithAuthorization(`Bot ${token}`);
  const ids = guilds
    .map((guild) => parseSnowflake(guild.id))
    .filter((id): id is string => id !== null);

  return new Set(ids);
}

export async function fetchFluxerGuildRoles(guildId: string): Promise<GuildRole[]> {
  const body = await requestFluxerBotApi(
    `/guilds/${guildId}/roles`,
    { method: "GET" },
    "Failed to fetch guild roles"
  );

  if (!Array.isArray(body)) {
    return [];
  }

  const roles = body
    .map((entry) => {
      const row = typeof entry === "object" && entry ? (entry as Record<string, unknown>) : {};
      const id = parseSnowflake(row.id);
      if (!id) {
        return null;
      }

      return {
        id,
        name: String(row.name ?? `Role ${id}`),
        position: Number(row.position ?? 0)
      } satisfies GuildRole;
    })
    .filter((value): value is GuildRole => value !== null)
    .sort((a, b) => b.position - a.position || a.id.localeCompare(b.id));

  return roles;
}

export async function kickFluxerMember(guildId: string, userId: string, reason?: string): Promise<void> {
  await requestFluxerBotApi(
    `/guilds/${guildId}/members/${userId}`,
    {
      method: "DELETE",
      headers: auditLogHeaders(reason)
    },
    "Failed to kick member"
  );
}

export async function banFluxerMember(
  guildId: string,
  userId: string,
  options?: {
    reason?: string;
    banDurationSeconds?: number;
    deleteMessageDays?: number;
    deleteMessageSeconds?: number;
  }
): Promise<void> {
  const payload: Record<string, number> = {};

  const banDurationSeconds = Number(options?.banDurationSeconds ?? 0);
  if (Number.isInteger(banDurationSeconds) && banDurationSeconds > 0) {
    payload.ban_duration_seconds = banDurationSeconds;
  }

  const deleteMessageDays = Number(options?.deleteMessageDays ?? 0);
  if (Number.isInteger(deleteMessageDays) && deleteMessageDays > 0) {
    payload.delete_message_days = deleteMessageDays;
  }

  const deleteMessageSeconds = Number(options?.deleteMessageSeconds ?? 0);
  if (Number.isInteger(deleteMessageSeconds) && deleteMessageSeconds > 0) {
    payload.delete_message_seconds = deleteMessageSeconds;
  }

  await requestFluxerBotApi(
    `/guilds/${guildId}/bans/${userId}`,
    {
      method: "PUT",
      headers: auditLogHeaders(options?.reason),
      body: Object.keys(payload).length ? JSON.stringify(payload) : undefined
    },
    "Failed to ban member"
  );
}

export async function unbanFluxerMember(guildId: string, userId: string, reason?: string): Promise<void> {
  await requestFluxerBotApi(
    `/guilds/${guildId}/bans/${userId}`,
    {
      method: "DELETE",
      headers: auditLogHeaders(reason)
    },
    "Failed to unban member"
  );
}

export async function setFluxerMemberTimeout(
  guildId: string,
  userId: string,
  untilIso: string | null,
  reason?: string
): Promise<void> {
  await requestFluxerBotApi(
    `/guilds/${guildId}/members/${userId}`,
    {
      method: "PATCH",
      headers: auditLogHeaders(reason),
      body: JSON.stringify({ communication_disabled_until: untilIso })
    },
    "Failed to update member timeout"
  );
}

export async function clearFluxerMemberTimeout(guildId: string, userId: string, reason?: string): Promise<void> {
  await setFluxerMemberTimeout(guildId, userId, null, reason);
}

export async function addFluxerMemberRole(
  guildId: string,
  userId: string,
  roleId: string,
  reason?: string
): Promise<void> {
  await requestFluxerBotApi(
    `/guilds/${guildId}/members/${userId}/roles/${roleId}`,
    {
      method: "PUT",
      headers: auditLogHeaders(reason)
    },
    "Failed to add member role"
  );
}

export async function removeFluxerMemberRole(
  guildId: string,
  userId: string,
  roleId: string,
  reason?: string
): Promise<void> {
  await requestFluxerBotApi(
    `/guilds/${guildId}/members/${userId}/roles/${roleId}`,
    {
      method: "DELETE",
      headers: auditLogHeaders(reason)
    },
    "Failed to remove member role"
  );
}

export async function fetchFluxerChannelMessages(channelId: string, limit = 50): Promise<string[]> {
  const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 100));
  const params = new URLSearchParams({ limit: String(safeLimit) });

  const body = await requestFluxerBotApi(
    `/channels/${channelId}/messages?${params.toString()}`,
    { method: "GET" },
    "Failed to list channel messages"
  );

  if (!Array.isArray(body)) {
    return [];
  }

  return body
    .map((entry) => parseSnowflake((entry as FluxerMessageLike)?.id))
    .filter((id): id is string => id !== null);
}

export async function deleteFluxerChannelMessage(channelId: string, messageId: string): Promise<void> {
  await requestFluxerBotApi(
    `/channels/${channelId}/messages/${messageId}`,
    { method: "DELETE" },
    "Failed to delete message"
  );
}

export async function bulkDeleteFluxerChannelMessages(channelId: string, messageIds: string[]): Promise<void> {
  const cleaned = messageIds
    .map((id) => parseSnowflake(id))
    .filter((id): id is string => id !== null);

  if (cleaned.length === 0) {
    return;
  }

  await requestFluxerBotApi(
    `/channels/${channelId}/messages/bulk-delete`,
    {
      method: "POST",
      body: JSON.stringify({ message_ids: cleaned })
    },
    "Failed to bulk delete messages"
  );
}
