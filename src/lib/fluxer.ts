import crypto from "node:crypto";
import { env } from "@/lib/env";
import type { FluxerGuild, FluxerGuildChannel, FluxerUser } from "@/lib/types";

const PERMISSION_ADMINISTRATOR = 0x8n;
const PERMISSION_MANAGE_GUILD = 0x20n;

function toSnowflake(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return /^\d{5,22}$/.test(text) ? text : null;
}

function toPermissionsBitfield(value: unknown): bigint {
  try {
    const text = String(value ?? "0").trim();
    return BigInt(text || "0");
  } catch {
    return 0n;
  }
}

function normalizeGuild(raw: unknown): FluxerGuild | null {
  const item = raw as Record<string, unknown>;
  const id = toSnowflake(item?.id);
  const name = String(item?.name || "").trim();
  if (!id || !name) {
    return null;
  }

  const iconHash = String(item?.icon || "").trim();
  const iconUrl =
    typeof item?.icon_url === "string" && item.icon_url.trim()
      ? item.icon_url.trim()
      : iconHash
        ? `https://cdn.discordapp.com/icons/${id}/${iconHash}.png?size=256`
        : null;

  return {
    id,
    name,
    iconUrl,
    permissions: String(item?.permissions || item?.permissions_new || "0")
  };
}

function normalizeUser(raw: unknown): FluxerUser {
  const item = raw as Record<string, unknown>;
  const id = toSnowflake(item?.id) || "0";
  const username = String(item?.username || item?.name || id);
  const globalName = item?.global_name ? String(item.global_name) : null;

  let avatarUrl: string | null = null;
  if (typeof item?.avatar_url === "string" && item.avatar_url.trim()) {
    avatarUrl = item.avatar_url.trim();
  } else if (item?.avatar) {
    const avatarHash = String(item.avatar);
    avatarUrl = `https://cdn.discordapp.com/avatars/${id}/${avatarHash}.png?size=256`;
  }

  return {
    id,
    username,
    globalName,
    avatarUrl
  };
}

function normalizeGuildChannel(raw: unknown, guildId: string): FluxerGuildChannel | null {
  const item = raw as Record<string, unknown>;
  const id = toSnowflake(item?.id);
  const normalizedGuildId = toSnowflake(item?.guild_id) || guildId;
  const name = String(item?.name || "").trim();

  if (!id || !normalizedGuildId || !name) {
    return null;
  }

  const typeNumber = Number(item?.type);
  const positionNumber = Number(item?.position);

  return {
    id,
    guildId: normalizedGuildId,
    name,
    type: Number.isFinite(typeNumber) ? Math.trunc(typeNumber) : 0,
    position: Number.isFinite(positionNumber) ? Math.trunc(positionNumber) : 0,
    parentId: toSnowflake(item?.parent_id)
  };
}

async function fetchJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Fluxer API ${response.status}: ${text || response.statusText}`);
  }

  return (await response.json()) as T;
}

export function createOAuthState(): string {
  return crypto.randomBytes(18).toString("hex");
}

export function buildFluxerAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.fluxerClientId,
    response_type: "code",
    redirect_uri: env.fluxerRedirectUri,
    scope: "identify guilds",
    state
  });

  return `${env.fluxerAuthorizeUrl}?${params.toString()}`;
}

export async function exchangeOAuthCodeForToken(code: string): Promise<{ accessToken: string; expiresIn: number }> {
  const body = new URLSearchParams({
    client_id: env.fluxerClientId,
    client_secret: env.fluxerClientSecret,
    grant_type: "authorization_code",
    redirect_uri: env.fluxerRedirectUri,
    code
  });

  const response = await fetch(env.fluxerTokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${text}`);
  }

  const payload = (await response.json()) as Record<string, unknown>;
  return {
    accessToken: String(payload.access_token || ""),
    expiresIn: Number(payload.expires_in || 3600)
  };
}

export async function fetchCurrentUser(accessToken: string): Promise<FluxerUser> {
  const raw = await fetchJson<unknown>(`${env.fluxerApiBaseUrl}/users/@me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    cache: "no-store"
  });

  return normalizeUser(raw);
}

export async function fetchUserGuilds(accessToken: string): Promise<FluxerGuild[]> {
  const raw = await fetchJson<unknown>(`${env.fluxerApiBaseUrl}/users/@me/guilds`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    cache: "no-store"
  });

  const list = Array.isArray(raw) ? raw : [];
  return list.map(normalizeGuild).filter((item): item is FluxerGuild => Boolean(item));
}

export async function fetchBotGuilds(botToken: string): Promise<FluxerGuild[]> {
  if (!botToken) {
    return [];
  }

  const raw = await fetchJson<unknown>(`${env.fluxerApiBaseUrl}/users/@me/guilds`, {
    headers: {
      Authorization: `Bot ${botToken}`
    },
    cache: "no-store"
  });

  const list = Array.isArray(raw) ? raw : [];
  return list.map(normalizeGuild).filter((item): item is FluxerGuild => Boolean(item));
}

export async function fetchGuildChannels(guildId: string, botToken = env.botToken): Promise<FluxerGuildChannel[]> {
  const normalizedGuildId = toSnowflake(guildId);
  if (!botToken || !normalizedGuildId) {
    return [];
  }

  const raw = await fetchJson<unknown>(`${env.fluxerApiBaseUrl}/guilds/${normalizedGuildId}/channels`, {
    headers: {
      Authorization: `Bot ${botToken}`
    },
    cache: "no-store"
  });

  const list = Array.isArray(raw)
    ? raw
    : typeof raw === "object" && raw !== null && Array.isArray((raw as Record<string, unknown>).channels)
      ? ((raw as Record<string, unknown>).channels as unknown[])
      : [];

  return list
    .map((entry) => normalizeGuildChannel(entry, normalizedGuildId))
    .filter((channel): channel is FluxerGuildChannel => Boolean(channel))
    .sort((a, b) => {
      if (a.position !== b.position) {
        return a.position - b.position;
      }

      return a.name.localeCompare(b.name);
    });
}

export function hasGuildManagePermission(guild: FluxerGuild): boolean {
  const bitfield = toPermissionsBitfield(guild.permissions);
  return (bitfield & PERMISSION_ADMINISTRATOR) === PERMISSION_ADMINISTRATOR || (bitfield & PERMISSION_MANAGE_GUILD) === PERMISSION_MANAGE_GUILD;
}

export function intersectGuilds(userGuilds: FluxerGuild[], botGuilds: FluxerGuild[]): FluxerGuild[] {
  const botMap = new Map(botGuilds.map((guild) => [guild.id, guild]));
  return userGuilds
    .filter((guild) => hasGuildManagePermission(guild) && botMap.has(guild.id))
    .map((guild) => {
      const botGuild = botMap.get(guild.id)!;
      return {
        ...guild,
        name: guild.name || botGuild.name,
        iconUrl: guild.iconUrl || botGuild.iconUrl
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function sendBotDirectMessage(userId: string, content: string): Promise<boolean> {
  if (!env.botToken || !toSnowflake(userId) || !content.trim()) {
    return false;
  }

  try {
    const dmChannel = (await fetchJson<Record<string, unknown>>(`${env.fluxerApiBaseUrl}/users/@me/channels`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${env.botToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ recipient_id: userId }),
      cache: "no-store"
    })) as Record<string, unknown>;

    const channelId = toSnowflake(dmChannel.id);
    if (!channelId) {
      return false;
    }

    await fetchJson(`${env.fluxerApiBaseUrl}/channels/${channelId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${env.botToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ content }),
      cache: "no-store"
    });

    return true;
  } catch {
    return false;
  }
}
