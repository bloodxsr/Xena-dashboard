import { Pool, type QueryResultRow } from "pg";

import { env } from "@/lib/env";
import type {
  CommandToggleRecord,
  GuildConfigRecord,
  RaidGateRecord,
  TotpRecord,
  WarningRecord
} from "@/lib/types";

const DEFAULT_WELCOME_MESSAGE_TEMPLATE = "Welcome {user.mention} to {guild.name}.";
const DEFAULT_LEVELUP_MESSAGE_TEMPLATE = "Level Up: {user.mention} reached level {level}. Rank #{rank}.";

export const KNOWN_TOGGLEABLE_COMMANDS: string[] = [
  "aboutserver",
  "addbadword",
  "addrole",
  "ask",
  "ban",
  "kick",
  "joke",
  "leaderboard",
  "level",
  "mute",
  "pendingverifications",
  "perks",
  "purge",
  "raidgate",
  "raidsnapshot",
  "rank",
  "reactionroleadd",
  "reactionroleclear",
  "reactionrolelist",
  "reactionroleremove",
  "rejectjoin",
  "reloadwords",
  "removerole",
  "removebadword",
  "serverconfig",
  "serverinfo",
  "serverstats",
  "setlevelingchannel",
  "setlogchannel",
  "setraidsettings",
  "setresourcechannels",
  "setroles",
  "setverificationurl",
  "setwelcomechannel",
  "stats",
  "unban",
  "unmute",
  "verifyjoin",
  "viewbadwords",
  "warnings"
];

function nowIso(): string {
  return new Date().toISOString();
}

function toSnowflake(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return /^\d{5,22}$/.test(text) ? text : null;
}

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  const text = String(value ?? "").trim().toLowerCase();
  if (["1", "true", "t", "yes", "on"].includes(text)) {
    return true;
  }

  if (["0", "false", "f", "no", "off", ""].includes(text)) {
    return false;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric !== 0 : false;
}

function toInteger(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.trunc(numeric);
}

function toFloat(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeCommandName(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
}

function normalizeTemplateText(value: unknown, fallback: string): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

let pool: Pool | null = null;
let initPromise: Promise<void> | null = null;

function getPool(): Pool {
  if (!pool) {
    if (!env.postgresHost || !env.postgresUser || !env.postgresDatabase) {
      throw new Error(
        "Missing PostgreSQL configuration. Set POSTGRES_HOST, POSTGRES_USER, and POSTGRES_DATABASE."
      );
    }

    pool = new Pool({
      host: env.postgresHost,
      port: env.postgresPort,
      user: env.postgresUser,
      password: env.postgresPassword,
      database: env.postgresDatabase,
      max: env.postgresPoolMax,
      ssl: env.postgresSslMode === "required" ? { rejectUnauthorized: false } : undefined
    });
  }

  return pool;
}

async function queryRows<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const result = await getPool().query<T>(sql, params);
  return result.rows;
}

async function execute(sql: string, params: unknown[] = []): Promise<void> {
  await getPool().query(sql, params);
}

async function ensureTableColumn(
  tableName: string,
  columnName: string,
  columnDefinition: string
): Promise<void> {
  const rows = await queryRows<{ total_count: number }>(
    `
      SELECT COUNT(*)::int AS total_count
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = $1
        AND column_name = $2
    `,
    [tableName, columnName]
  );

  if (toInteger(rows[0]?.total_count, 0) === 0) {
    await execute(`ALTER TABLE "${tableName}" ADD COLUMN "${columnName}" ${columnDefinition}`);
  }
}

async function initializeSchema(): Promise<void> {
  await execute(`
    CREATE TABLE IF NOT EXISTS guild_config (
      guild_id VARCHAR(22) PRIMARY KEY,
      log_channel_id VARCHAR(22) NULL,
      welcome_channel_id VARCHAR(22) NULL,
      rules_channel_id VARCHAR(22) NULL,
      chat_channel_id VARCHAR(22) NULL,
      help_channel_id VARCHAR(22) NULL,
      about_channel_id VARCHAR(22) NULL,
      perks_channel_id VARCHAR(22) NULL,
      leveling_channel_id VARCHAR(22) NULL,
      welcome_message_template TEXT NULL,
      levelup_message_template TEXT NULL,
      admin_role_name VARCHAR(80) NOT NULL DEFAULT 'Admin',
      mod_role_name VARCHAR(80) NOT NULL DEFAULT 'Moderator',
      sync_mode VARCHAR(24) NOT NULL DEFAULT 'global',
      sync_guild_id VARCHAR(22) NULL,
      verification_url TEXT NULL,
      leveling_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      raid_detection_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      raid_gate_threshold DOUBLE PRECISION NOT NULL DEFAULT 0.72,
      raid_monitor_window_seconds INTEGER NOT NULL DEFAULT 90,
      raid_join_rate_threshold INTEGER NOT NULL DEFAULT 8,
      gate_duration_seconds INTEGER NOT NULL DEFAULT 900,
      join_gate_mode VARCHAR(16) NOT NULL DEFAULT 'timeout'
    )
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS raid_state (
      guild_id VARCHAR(22) PRIMARY KEY,
      gate_active BOOLEAN NOT NULL DEFAULT FALSE,
      gate_reason TEXT NULL,
      gate_until VARCHAR(64) NULL,
      updated_at VARCHAR(64) NULL
    )
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS warnings (
      guild_id VARCHAR(22) NOT NULL,
      user_id VARCHAR(22) NOT NULL,
      warning_count INTEGER NOT NULL DEFAULT 0,
      updated_at VARCHAR(64) NOT NULL,
      PRIMARY KEY (guild_id, user_id)
    )
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS member_levels (
      guild_id VARCHAR(22) NOT NULL,
      user_id VARCHAR(22) NOT NULL,
      xp INTEGER NOT NULL DEFAULT 0,
      level INTEGER NOT NULL DEFAULT 0,
      message_count INTEGER NOT NULL DEFAULT 0,
      last_xp_at VARCHAR(64) NULL,
      updated_at VARCHAR(64) NOT NULL,
      PRIMARY KEY (guild_id, user_id)
    )
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS staff_totp (
      guild_id VARCHAR(22) NOT NULL,
      user_id VARCHAR(22) NOT NULL,
      secret_base32 TEXT NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      created_at VARCHAR(64) NOT NULL,
      updated_at VARCHAR(64) NOT NULL,
      last_verified_at VARCHAR(64) NULL,
      PRIMARY KEY (guild_id, user_id)
    )
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS command_toggles (
      guild_id VARCHAR(22) NOT NULL,
      command_name VARCHAR(100) NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at VARCHAR(64) NOT NULL,
      PRIMARY KEY (guild_id, command_name)
    )
  `);

  await ensureTableColumn("guild_config", "welcome_message_template", "TEXT NULL");
  await ensureTableColumn("guild_config", "levelup_message_template", "TEXT NULL");

  await execute(
    "UPDATE guild_config SET welcome_message_template = $1 WHERE welcome_message_template IS NULL OR TRIM(welcome_message_template) = ''",
    [DEFAULT_WELCOME_MESSAGE_TEMPLATE]
  );
  await execute(
    "UPDATE guild_config SET levelup_message_template = $1 WHERE levelup_message_template IS NULL OR TRIM(levelup_message_template) = ''",
    [DEFAULT_LEVELUP_MESSAGE_TEMPLATE]
  );
}

async function ensureInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = initializeSchema();
  }

  await initPromise;
}

async function ensureGuildConfig(guildId: string): Promise<void> {
  const normalizedGuildId = toSnowflake(guildId);
  if (!normalizedGuildId) {
    throw new Error("Invalid guild id");
  }

  await ensureInitialized();
  await execute(
    "INSERT INTO guild_config (guild_id) VALUES ($1) ON CONFLICT (guild_id) DO NOTHING",
    [normalizedGuildId]
  );
}

export async function listKnownGuildIds(limit = 1000): Promise<string[]> {
  await ensureInitialized();
  const normalizedLimit = Math.max(1, Math.min(toInteger(limit, 1000), 5000));
  const rows = await queryRows<{ guild_id: string }>(
    `
      SELECT guild_id
      FROM guild_config
      ORDER BY guild_id ASC
      LIMIT $1
    `,
    [normalizedLimit]
  );

  return rows.map((row) => toSnowflake(row.guild_id)).filter((item): item is string => Boolean(item));
}

export async function getGuildConfig(guildId: string): Promise<GuildConfigRecord> {
  await ensureGuildConfig(guildId);
  const rows = await queryRows<Record<string, unknown>>(
    "SELECT * FROM guild_config WHERE guild_id = $1 LIMIT 1",
    [guildId]
  );
  const row = rows[0] || {};

  return {
    guild_id: String(toSnowflake(row.guild_id) || guildId),
    log_channel_id: toSnowflake(row.log_channel_id),
    welcome_channel_id: toSnowflake(row.welcome_channel_id),
    rules_channel_id: toSnowflake(row.rules_channel_id),
    chat_channel_id: toSnowflake(row.chat_channel_id),
    help_channel_id: toSnowflake(row.help_channel_id),
    about_channel_id: toSnowflake(row.about_channel_id),
    perks_channel_id: toSnowflake(row.perks_channel_id),
    leveling_channel_id: toSnowflake(row.leveling_channel_id),
    welcome_message_template: normalizeTemplateText(
      row.welcome_message_template,
      DEFAULT_WELCOME_MESSAGE_TEMPLATE
    ),
    levelup_message_template: normalizeTemplateText(
      row.levelup_message_template,
      DEFAULT_LEVELUP_MESSAGE_TEMPLATE
    ),
    admin_role_name: String(row.admin_role_name || "Admin"),
    mod_role_name: String(row.mod_role_name || "Moderator"),
    verification_url: row.verification_url ? String(row.verification_url) : null,
    raid_gate_threshold: toFloat(row.raid_gate_threshold, 0.72),
    raid_monitor_window_seconds: toInteger(row.raid_monitor_window_seconds, 90),
    raid_join_rate_threshold: toInteger(row.raid_join_rate_threshold, 8),
    gate_duration_seconds: toInteger(row.gate_duration_seconds, 900),
    join_gate_mode: String(row.join_gate_mode || "timeout") === "kick" ? "kick" : "timeout"
  };
}

export async function updateGuildConfig(
  guildId: string,
  updates: Partial<GuildConfigRecord>
): Promise<GuildConfigRecord> {
  await ensureGuildConfig(guildId);

  const allowed = new Set([
    "log_channel_id",
    "welcome_channel_id",
    "rules_channel_id",
    "chat_channel_id",
    "help_channel_id",
    "about_channel_id",
    "perks_channel_id",
    "leveling_channel_id",
    "welcome_message_template",
    "levelup_message_template",
    "admin_role_name",
    "mod_role_name",
    "verification_url",
    "raid_gate_threshold",
    "raid_monitor_window_seconds",
    "raid_join_rate_threshold",
    "gate_duration_seconds",
    "join_gate_mode"
  ]);

  const entries = Object.entries(updates).filter(([key]) => allowed.has(key));
  if (entries.length === 0) {
    return getGuildConfig(guildId);
  }

  const normalized: Record<string, unknown> = {};

  for (const [key, rawValue] of entries) {
    if (key.endsWith("_channel_id")) {
      normalized[key] = toSnowflake(rawValue);
      continue;
    }

    if (key === "welcome_message_template") {
      normalized[key] = normalizeTemplateText(rawValue, DEFAULT_WELCOME_MESSAGE_TEMPLATE);
      continue;
    }

    if (key === "levelup_message_template") {
      normalized[key] = normalizeTemplateText(rawValue, DEFAULT_LEVELUP_MESSAGE_TEMPLATE);
      continue;
    }

    if (key === "verification_url") {
      const text = String(rawValue ?? "").trim();
      normalized[key] = text || null;
      continue;
    }

    if (key === "raid_gate_threshold") {
      normalized[key] = Math.max(0, Math.min(Number(rawValue), 1));
      continue;
    }

    if (["raid_monitor_window_seconds", "raid_join_rate_threshold", "gate_duration_seconds"].includes(key)) {
      normalized[key] = Math.max(1, toInteger(rawValue, 1));
      continue;
    }

    if (key === "join_gate_mode") {
      normalized[key] = String(rawValue || "timeout").toLowerCase() === "kick" ? "kick" : "timeout";
      continue;
    }

    normalized[key] = rawValue;
  }

  const fields = Object.keys(normalized);
  if (fields.length > 0) {
    const setClause = fields.map((field, index) => `"${field}" = $${index + 1}`).join(", ");
    const params = [...fields.map((field) => normalized[field]), guildId];
    await execute(`UPDATE guild_config SET ${setClause} WHERE guild_id = $${fields.length + 1}`, params);
  }

  return getGuildConfig(guildId);
}

export async function getRaidGateState(guildId: string): Promise<RaidGateRecord> {
  await ensureInitialized();
  const rows = await queryRows<Record<string, unknown>>(
    "SELECT gate_active, gate_reason, gate_until, updated_at FROM raid_state WHERE guild_id = $1 LIMIT 1",
    [guildId]
  );
  const row = rows[0];

  if (!row) {
    return {
      gate_active: false,
      gate_reason: null,
      gate_until: null,
      updated_at: null
    };
  }

  return {
    gate_active: toBoolean(row.gate_active),
    gate_reason: row.gate_reason ? String(row.gate_reason) : null,
    gate_until: row.gate_until ? String(row.gate_until) : null,
    updated_at: row.updated_at ? String(row.updated_at) : null
  };
}

export async function setRaidGateState(
  guildId: string,
  gateActive: boolean,
  reason: string | null,
  gateUntil: string | null
): Promise<RaidGateRecord> {
  await ensureInitialized();
  await execute(
    `
      INSERT INTO raid_state (guild_id, gate_active, gate_reason, gate_until, updated_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (guild_id) DO UPDATE SET
        gate_active = EXCLUDED.gate_active,
        gate_reason = EXCLUDED.gate_reason,
        gate_until = EXCLUDED.gate_until,
        updated_at = EXCLUDED.updated_at
    `,
    [guildId, gateActive, reason, gateUntil, nowIso()]
  );

  return getRaidGateState(guildId);
}

export async function listWarningCounts(guildId: string, limit = 50): Promise<WarningRecord[]> {
  await ensureInitialized();
  const normalizedLimit = Math.max(1, Math.min(toInteger(limit, 50), 200));
  const rows = await queryRows<Record<string, unknown>>(
    `
      SELECT user_id, warning_count, updated_at
      FROM warnings
      WHERE guild_id = $1
      ORDER BY warning_count DESC, updated_at DESC
      LIMIT $2
    `,
    [guildId, normalizedLimit]
  );

  return rows.map((row) => ({
    user_id: String(toSnowflake(row.user_id) || "0"),
    warning_count: Math.max(0, toInteger(row.warning_count, 0)),
    updated_at: String(row.updated_at || nowIso())
  }));
}

export async function listTopLevelMembers(
  guildId: string,
  limit = 3
): Promise<Array<{ user_id: string; level: number; xp: number }>> {
  await ensureInitialized();
  const normalizedLimit = Math.max(1, Math.min(toInteger(limit, 3), 10));
  const rows = await queryRows<Record<string, unknown>>(
    `
      SELECT user_id, level, xp
      FROM member_levels
      WHERE guild_id = $1
      ORDER BY level DESC, xp DESC, message_count DESC, user_id ASC
      LIMIT $2
    `,
    [guildId, normalizedLimit]
  );

  return rows.map((row) => ({
    user_id: String(toSnowflake(row.user_id) || "0"),
    level: Math.max(0, toInteger(row.level, 0)),
    xp: Math.max(0, toInteger(row.xp, 0))
  }));
}

export async function countTrackedLevelMembers(guildId: string): Promise<number> {
  await ensureInitialized();
  const rows = await queryRows<{ total_count: number }>(
    `
      SELECT COUNT(*)::int AS total_count
      FROM member_levels
      WHERE guild_id = $1
    `,
    [guildId]
  );

  return Math.max(0, toInteger(rows[0]?.total_count, 0));
}

export async function listCommandToggles(guildId: string): Promise<CommandToggleRecord[]> {
  await ensureInitialized();
  const rows = await queryRows<Record<string, unknown>>(
    `
      SELECT command_name, enabled, updated_at
      FROM command_toggles
      WHERE guild_id = $1
      ORDER BY command_name ASC
    `,
    [guildId]
  );

  return rows.map((row) => ({
    command_name: normalizeCommandName(row.command_name),
    enabled: toBoolean(row.enabled),
    updated_at: String(row.updated_at || nowIso())
  }));
}

export async function getCommandStates(guildId: string): Promise<CommandToggleRecord[]> {
  const persisted = await listCommandToggles(guildId);
  const persistedMap = new Map(persisted.map((row) => [row.command_name, row]));

  const seeded: CommandToggleRecord[] = [...KNOWN_TOGGLEABLE_COMMANDS].map((commandName) => {
    const existing = persistedMap.get(commandName);
    return {
      command_name: commandName,
      enabled: existing ? existing.enabled : true,
      updated_at: existing ? existing.updated_at : nowIso()
    };
  });

  for (const row of persisted) {
    if (!seeded.some((entry) => entry.command_name === row.command_name)) {
      seeded.push(row);
    }
  }

  return seeded.sort((a, b) => a.command_name.localeCompare(b.command_name));
}

export async function setCommandEnabled(
  guildId: string,
  commandName: string,
  enabled: boolean
): Promise<CommandToggleRecord> {
  await ensureInitialized();
  const normalized = normalizeCommandName(commandName);
  if (!normalized) {
    throw new Error("Invalid command name");
  }

  const updatedAt = nowIso();
  await execute(
    `
      INSERT INTO command_toggles (guild_id, command_name, enabled, updated_at)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (guild_id, command_name) DO UPDATE SET
        enabled = EXCLUDED.enabled,
        updated_at = EXCLUDED.updated_at
    `,
    [guildId, normalized, enabled, updatedAt]
  );

  return {
    command_name: normalized,
    enabled,
    updated_at: updatedAt
  };
}

export async function getStaffTotpAuth(guildId: string, userId: string): Promise<TotpRecord | null> {
  await ensureInitialized();
  const rows = await queryRows<Record<string, unknown>>(
    `
      SELECT guild_id,
             user_id,
             secret_base32,
             enabled,
             created_at,
             updated_at,
             last_verified_at
      FROM staff_totp
      WHERE guild_id = $1 AND user_id = $2
      LIMIT 1
    `,
    [guildId, userId]
  );
  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    guild_id: String(toSnowflake(row.guild_id) || guildId),
    user_id: String(toSnowflake(row.user_id) || userId),
    secret_base32: String(row.secret_base32 || ""),
    enabled: toBoolean(row.enabled),
    created_at: String(row.created_at || nowIso()),
    updated_at: String(row.updated_at || nowIso()),
    last_verified_at: row.last_verified_at ? String(row.last_verified_at) : null
  };
}

export async function upsertStaffTotpAuth(params: {
  guildId: string;
  userId: string;
  secretBase32: string;
  enabled?: boolean;
  lastVerifiedAt?: string | null;
}): Promise<TotpRecord> {
  await ensureInitialized();
  const normalizedGuildId = toSnowflake(params.guildId);
  const normalizedUserId = toSnowflake(params.userId);
  const normalizedSecret = String(params.secretBase32 || "")
    .trim()
    .toUpperCase();

  if (!normalizedGuildId || !normalizedUserId || !normalizedSecret) {
    throw new Error("Invalid TOTP payload");
  }

  const now = nowIso();
  await execute(
    `
      INSERT INTO staff_totp (guild_id, user_id, secret_base32, enabled, created_at, updated_at, last_verified_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (guild_id, user_id) DO UPDATE SET
        secret_base32 = EXCLUDED.secret_base32,
        enabled = EXCLUDED.enabled,
        updated_at = EXCLUDED.updated_at,
        last_verified_at = EXCLUDED.last_verified_at
    `,
    [
      normalizedGuildId,
      normalizedUserId,
      normalizedSecret,
      params.enabled === false ? false : true,
      now,
      now,
      params.lastVerifiedAt == null ? null : String(params.lastVerifiedAt)
    ]
  );

  const result = await getStaffTotpAuth(normalizedGuildId, normalizedUserId);
  if (!result) {
    throw new Error("Failed to upsert TOTP record");
  }

  return result;
}

export async function markStaffTotpVerified(
  guildId: string,
  userId: string,
  verifiedAt?: string
): Promise<TotpRecord | null> {
  await ensureInitialized();
  const now = nowIso();
  const when = verifiedAt ? String(verifiedAt) : now;

  await execute(
    `
      UPDATE staff_totp
      SET enabled = TRUE, last_verified_at = $1, updated_at = $2
      WHERE guild_id = $3 AND user_id = $4
    `,
    [when, now, guildId, userId]
  );

  return getStaffTotpAuth(guildId, userId);
}
