import path from "node:path";
import { fileURLToPath } from "node:url";

type DashboardEnv = {
  appBaseUrl: string;
  fluxerWebBase: string;
  fluxerApiBase: string;
  fluxerRedirectUri: string | null;
  fluxerClientId: string | null;
  fluxerClientSecret: string | null;
  fluxerOauthScope: string;
  sessionSecret: string;
  databasePath: string;
  botToken: string | null;
  fluxerAdminUserId: number;
  fluxerAdminUsername: string;
  fluxerDashboardKey: string | null;
  fluxerAllowedGuildIds: Set<string>;
};

let cachedEnv: DashboardEnv | null = null;

function optionalValue(value: string | undefined): string {
  return (value ?? "").trim();
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number(optionalValue(raw));
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function normalizeBaseUrl(value: string | undefined, fallback: string): string {
  const normalized = optionalValue(value) || fallback;
  return normalized.replace(/\/$/, "");
}

function parseGuildIds(raw: string | undefined): Set<string> {
  const cleaned = optionalValue(raw);
  if (!cleaned) {
    return new Set<string>();
  }

  const ids = cleaned
    .split(",")
    .map((part) => part.trim())
    .filter((value) => /^\d{5,22}$/.test(value));

  return new Set(ids);
}

function getDefaultDatabasePath(): string {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const workspaceDir = path.resolve(moduleDir, "../../..");
  return path.resolve(workspaceDir, "bot/warnings.db");
}

export function getEnv(): DashboardEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const appBaseUrl = normalizeBaseUrl(process.env.APP_BASE_URL, "http://127.0.0.1:3000");
  const fluxerWebBase = normalizeBaseUrl(process.env.FLUXER_WEB_BASE, "https://web.fluxer.app");
  const fluxerApiBase = normalizeBaseUrl(process.env.FLUXER_API_BASE, "https://api.fluxer.app");
  const fluxerRedirectUri = optionalValue(process.env.FLUXER_REDIRECT_URI) || null;

  const databasePathRaw = (process.env.DATABASE_PATH ?? "").trim();
  const databasePath = databasePathRaw ? path.resolve(databasePathRaw) : getDefaultDatabasePath();

  const sessionSecret = optionalValue(process.env.SESSION_SECRET) || "fluxer-dev-session-secret";

  const botToken =
    (process.env.FLUXER_BOT_TOKEN ?? "").trim() ||
    (process.env.BOT_TOKEN ?? "").trim() ||
    null;

  const fluxerClientId = optionalValue(process.env.FLUXER_CLIENT_ID) || null;
  const fluxerClientSecret = optionalValue(process.env.FLUXER_CLIENT_SECRET) || null;
  const fluxerOauthScope = optionalValue(process.env.FLUXER_OAUTH_SCOPE) || "identify guilds";

  const fluxerAdminUserId = parsePositiveInt(process.env.FLUXER_ADMIN_USER_ID, 1);
  const fluxerAdminUsername = optionalValue(process.env.FLUXER_ADMIN_USERNAME) || "Fluxer Admin";
  const fluxerDashboardKey = optionalValue(process.env.FLUXER_DASHBOARD_KEY) || null;
  const fluxerAllowedGuildIds = parseGuildIds(process.env.FLUXER_ALLOWED_GUILD_IDS);

  cachedEnv = {
    appBaseUrl,
    fluxerWebBase,
    fluxerApiBase,
    fluxerRedirectUri,
    fluxerClientId,
    fluxerClientSecret,
    fluxerOauthScope,
    sessionSecret,
    databasePath,
    botToken,
    fluxerAdminUserId,
    fluxerAdminUsername,
    fluxerDashboardKey,
    fluxerAllowedGuildIds
  };

  return cachedEnv;
}
