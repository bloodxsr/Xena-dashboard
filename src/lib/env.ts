import crypto from "node:crypto";
import path from "node:path";

type DashboardDbDriver = "sqlite" | "postgres";
type PostgresSslMode = "disabled" | "required";

const WEAK_SESSION_SECRET_VALUES = new Set([
  "change-this-secret",
  "dev-only-secret-change-me",
  "secret",
  "password",
  "replace-me",
  "replace-with-min-32-char-random-secret"
]);

const WEAK_POSTGRES_PASSWORD_VALUES = new Set([
  "postgres",
  "password",
  "replace-with-strong-password"
]);

function parseInteger(value: string | undefined, fallback: number, min: number, max: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  const truncated = Math.trunc(numeric);
  return Math.max(min, Math.min(max, truncated));
}

function normalizeUrl(value: string | undefined, fallback: string): string {
  const text = String(value || fallback).trim();
  return text.endsWith("/") ? text.slice(0, -1) : text;
}

function normalizeNodeEnv(value: string | undefined): string {
  return String(value || "development").trim().toLowerCase();
}

function isWeakSessionSecret(value: string): boolean {
  const normalized = String(value || "").trim();
  if (normalized.length < 32) {
    return true;
  }

  return WEAK_SESSION_SECRET_VALUES.has(normalized.toLowerCase());
}

function assertEnvValuePresent(name: string, value: string): void {
  if (!String(value || "").trim()) {
    throw new Error(`Missing required environment variable: ${name}.`);
  }
}

function parseDbDriver(value: string | undefined): DashboardDbDriver {
  const normalized = String(value || "postgres").trim().toLowerCase();
  return normalized === "sqlite" ? "sqlite" : "postgres";
}

function parsePostgresSslMode(value: string | undefined): PostgresSslMode {
  return String(value || "disabled").trim().toLowerCase() === "required" ? "required" : "disabled";
}

const processRoot = process.cwd();
const nodeEnv = normalizeNodeEnv(process.env.NODE_ENV);
const configuredSessionSecret = String(process.env.DASHBOARD_SESSION_SECRET || "").trim();
const generatedDevelopmentSessionSecret =
  nodeEnv === "production" ? "" : crypto.randomBytes(32).toString("hex");

if (!configuredSessionSecret && nodeEnv !== "production") {
  console.warn(
    "DASHBOARD_SESSION_SECRET is not set. Generated an ephemeral development secret for this process."
  );
}

export const env = {
  nodeEnv,
  dashboardBrandName: String(process.env.DASHBOARD_BRAND_NAME || "Fluxer Control").trim() || "Fluxer Control",
  dashboardSessionSecret: configuredSessionSecret || generatedDevelopmentSessionSecret,
  dashboardSessionTtlSeconds: parseInteger(process.env.DASHBOARD_SESSION_TTL_SECONDS, 60 * 60 * 8, 300, 60 * 60 * 24 * 14),
  fluxerClientId: String(process.env.FLUXER_CLIENT_ID || "").trim(),
  fluxerClientSecret: String(process.env.FLUXER_CLIENT_SECRET || "").trim(),
  fluxerRedirectUri: String(process.env.FLUXER_REDIRECT_URI || "http://localhost:3000/oauth/callback").trim(),
  fluxerAuthorizeUrl: normalizeUrl(process.env.FLUXER_OAUTH_AUTHORIZE_URL, "https://api.fluxer.app/oauth2/authorize"),
  fluxerTokenUrl: normalizeUrl(process.env.FLUXER_OAUTH_TOKEN_URL, "https://api.fluxer.app/oauth2/token"),
  fluxerApiBaseUrl: normalizeUrl(process.env.FLUXER_API_BASE_URL, "https://api.fluxer.app"),
  botToken: String(process.env.FLUXER_BOT_TOKEN || process.env.BOT_TOKEN || "").trim(),
  dashboardDbDriver: parseDbDriver(process.env.DASHBOARD_DB_DRIVER),
  botDatabasePath: String(
    process.env.BOT_DB_PATH || path.resolve(processRoot, "..", "bot_js", "data", "warnings.db")
  ).trim(),
  postgresHost: String(process.env.POSTGRES_HOST || "").trim(),
  postgresPort: parseInteger(process.env.POSTGRES_PORT, 5432, 1, 65535),
  postgresUser: String(process.env.POSTGRES_USER || "").trim(),
  postgresPassword: String(process.env.POSTGRES_PASSWORD || ""),
  postgresDatabase: String(process.env.POSTGRES_DATABASE || "").trim(),
  postgresPoolMax: parseInteger(process.env.POSTGRES_POOL_MAX, 10, 1, 100),
  postgresSslMode: parsePostgresSslMode(process.env.POSTGRES_SSL_MODE),
  totpIssuer: String(process.env.TOTP_ISSUER || "FluxerBot").trim() || "FluxerBot",
  totpCodeDigits: parseInteger(process.env.TOTP_CODE_DIGITS, 6, 6, 8),
  totpPeriodSeconds: parseInteger(process.env.TOTP_PERIOD_SECONDS, 30, 15, 120),
  totpVerifyWindowSteps: parseInteger(process.env.TOTP_VERIFY_WINDOW_STEPS, 1, 0, 5),
  totpAuthWindowDays: parseInteger(process.env.TOTP_AUTH_WINDOW_DAYS, 30, 1, 365)
};

function assertProductionSecurityConfig(): void {
  if (env.nodeEnv !== "production") {
    return;
  }

  assertEnvValuePresent("DASHBOARD_SESSION_SECRET", env.dashboardSessionSecret);

  if (isWeakSessionSecret(env.dashboardSessionSecret)) {
    throw new Error("DASHBOARD_SESSION_SECRET must be at least 32 characters and not a placeholder in production.");
  }

  assertEnvValuePresent("FLUXER_BOT_TOKEN", env.botToken);

  if (env.dashboardDbDriver === "postgres") {
    assertEnvValuePresent("POSTGRES_HOST", env.postgresHost);
    assertEnvValuePresent("POSTGRES_USER", env.postgresUser);
    assertEnvValuePresent("POSTGRES_PASSWORD", env.postgresPassword);
    assertEnvValuePresent("POSTGRES_DATABASE", env.postgresDatabase);

    if (WEAK_POSTGRES_PASSWORD_VALUES.has(env.postgresPassword.trim().toLowerCase())) {
      throw new Error("POSTGRES_PASSWORD must not use a placeholder or common default in production.");
    }
  }

  try {
    const redirectUrl = new URL(env.fluxerRedirectUri);
    const host = redirectUrl.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") {
      throw new Error("FLUXER_REDIRECT_URI must use a public host in production.");
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("public host")) {
      throw error;
    }

    throw new Error("FLUXER_REDIRECT_URI must be a valid absolute URL in production.");
  }
}

assertProductionSecurityConfig();

export function assertFluxerOAuthConfigured(): void {
  if (!env.fluxerClientId || !env.fluxerClientSecret) {
    throw new Error("Missing Fluxer OAuth configuration. Set FLUXER_CLIENT_ID and FLUXER_CLIENT_SECRET.");
  }
}
