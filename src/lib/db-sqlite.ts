import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
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
const DEFAULT_KICK_MESSAGE_TEMPLATE = "You were kicked from {guild.name}. Reason: {reason}.";
const DEFAULT_BAN_MESSAGE_TEMPLATE = "You were banned from {guild.name}. Reason: {reason}.";
const DEFAULT_MUTE_MESSAGE_TEMPLATE = "You were muted in {guild.name}. Reason: {reason}.";

export const KNOWN_TOGGLEABLE_COMMANDS: string[] = [
  "addbadword",
  "addrole",
  "ask",
  "ban",
  "join",
  "joke",
  "kick",
  "leaderboard",
  "leave",
  "level",
  "mute",
  "nowplaying",
  "pause",
  "pendingverifications",
  "perks",
  "play",
  "purge",
  "queue",
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
  "setlevelingchannel",
  "setlogchannel",
  "setraidsettings",
  "setresourcechannels",
  "setroles",
  "setverificationurl",
  "setwelcomechannel",
  "resume",
  "skip",
  "stats",
  "stop",
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
  return Number(value || 0) !== 0;
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

let sqliteInstance: Database.Database | null = null;
let sqliteSchemaInitialized = false;

function createSqliteInstance(): Database.Database {
  const sqliteDir = path.dirname(env.botDatabasePath);
  if (!fs.existsSync(sqliteDir)) {
    fs.mkdirSync(sqliteDir, { recursive: true });
  }

  const database = new Database(env.botDatabasePath);
  database.defaultSafeIntegers(true);
  database.pragma("journal_mode = WAL");
  return database;
}

function getSqliteInstance(): Database.Database {
  if (!sqliteInstance) {
    sqliteInstance = createSqliteInstance();
  }

  if (!sqliteSchemaInitialized) {
    initializeSchema(sqliteInstance);
    sqliteSchemaInitialized = true;
  }

  return sqliteInstance;
}

const sqlite = new Proxy({} as Database.Database, {
  get(_target, property) {
    const database = getSqliteInstance();
    const value = Reflect.get(database as unknown as object, property);
    if (typeof value === "function") {
      return value.bind(database);
    }
    return value;
  }
});

function ensureTableColumn(database: Database.Database, tableName: string, columnName: string, columnDefinition: string): void {
  const rows = database.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  const exists = rows.some((row) => String(row?.name || "").toLowerCase() === columnName.toLowerCase());
  if (!exists) {
    database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
  }
}

function initializeSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS guild_config (
      guild_id INTEGER PRIMARY KEY,
      log_channel_id INTEGER,
      welcome_channel_id INTEGER,
      rules_channel_id INTEGER,
      chat_channel_id INTEGER,
      help_channel_id INTEGER,
      about_channel_id INTEGER,
      perks_channel_id INTEGER,
      leveling_channel_id INTEGER,
      welcome_message_template TEXT,
      levelup_message_template TEXT,
      kick_message_template TEXT,
      ban_message_template TEXT,
      mute_message_template TEXT,
      admin_role_name TEXT NOT NULL DEFAULT 'Admin',
      mod_role_name TEXT NOT NULL DEFAULT 'Moderator',
      sync_mode TEXT NOT NULL DEFAULT 'global',
      sync_guild_id INTEGER,
      verification_url TEXT,
      leveling_enabled INTEGER NOT NULL DEFAULT 1,
      raid_detection_enabled INTEGER NOT NULL DEFAULT 1,
      raid_gate_threshold REAL NOT NULL DEFAULT 0.72,
      raid_monitor_window_seconds INTEGER NOT NULL DEFAULT 90,
      raid_join_rate_threshold INTEGER NOT NULL DEFAULT 8,
      gate_duration_seconds INTEGER NOT NULL DEFAULT 900,
      join_gate_mode TEXT NOT NULL DEFAULT 'timeout'
    );

    CREATE TABLE IF NOT EXISTS raid_state (
      guild_id INTEGER PRIMARY KEY,
      gate_active INTEGER NOT NULL DEFAULT 0,
      gate_reason TEXT,
      gate_until TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS warnings (
      guild_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      warning_count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (guild_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS member_levels (
      guild_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      xp INTEGER NOT NULL DEFAULT 0,
      level INTEGER NOT NULL DEFAULT 0,
      message_count INTEGER NOT NULL DEFAULT 0,
      last_xp_at TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (guild_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS staff_totp (
      guild_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      secret_base32 TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_verified_at TEXT,
      PRIMARY KEY (guild_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS command_toggles (
      guild_id INTEGER NOT NULL,
      command_name TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (guild_id, command_name)
    );
  `);

  ensureTableColumn(database, "guild_config", "welcome_message_template", "TEXT");
  ensureTableColumn(database, "guild_config", "levelup_message_template", "TEXT");
  ensureTableColumn(database, "guild_config", "kick_message_template", "TEXT");
  ensureTableColumn(database, "guild_config", "ban_message_template", "TEXT");
  ensureTableColumn(database, "guild_config", "mute_message_template", "TEXT");

  database
    .prepare(
      "UPDATE guild_config SET welcome_message_template = ? WHERE welcome_message_template IS NULL OR TRIM(welcome_message_template) = ''"
    )
    .run(DEFAULT_WELCOME_MESSAGE_TEMPLATE);
  database
    .prepare(
      "UPDATE guild_config SET levelup_message_template = ? WHERE levelup_message_template IS NULL OR TRIM(levelup_message_template) = ''"
    )
    .run(DEFAULT_LEVELUP_MESSAGE_TEMPLATE);
  database
    .prepare(
      "UPDATE guild_config SET kick_message_template = ? WHERE kick_message_template IS NULL OR TRIM(kick_message_template) = ''"
    )
    .run(DEFAULT_KICK_MESSAGE_TEMPLATE);
  database
    .prepare(
      "UPDATE guild_config SET ban_message_template = ? WHERE ban_message_template IS NULL OR TRIM(ban_message_template) = ''"
    )
    .run(DEFAULT_BAN_MESSAGE_TEMPLATE);
  database
    .prepare(
      "UPDATE guild_config SET mute_message_template = ? WHERE mute_message_template IS NULL OR TRIM(mute_message_template) = ''"
    )
    .run(DEFAULT_MUTE_MESSAGE_TEMPLATE);
}

function ensureGuildConfig(guildId: string): void {
  const normalizedGuildId = toSnowflake(guildId);
  if (!normalizedGuildId) {
    throw new Error("Invalid guild id");
  }

  sqlite.prepare("INSERT OR IGNORE INTO guild_config (guild_id) VALUES (?)").run(normalizedGuildId);
}

export function listKnownGuildIds(limit = 1000): string[] {
  const normalizedLimit = Math.max(1, Math.min(toInteger(limit, 1000), 5000));
  const rows = sqlite
    .prepare(
      `
        SELECT CAST(guild_id AS TEXT) AS guild_id
        FROM guild_config
        ORDER BY guild_id ASC
        LIMIT ?
      `
    )
    .all(normalizedLimit) as Array<{ guild_id: string }>;

  return rows.map((row) => toSnowflake(row.guild_id)).filter((item): item is string => Boolean(item));
}

export function getGuildConfig(guildId: string): GuildConfigRecord {
  ensureGuildConfig(guildId);
  const row = sqlite.prepare("SELECT * FROM guild_config WHERE guild_id = ?").get(guildId) as Record<string, unknown>;

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
    welcome_message_template: normalizeTemplateText(row.welcome_message_template, DEFAULT_WELCOME_MESSAGE_TEMPLATE),
    levelup_message_template: normalizeTemplateText(row.levelup_message_template, DEFAULT_LEVELUP_MESSAGE_TEMPLATE),
    kick_message_template: normalizeTemplateText(row.kick_message_template, DEFAULT_KICK_MESSAGE_TEMPLATE),
    ban_message_template: normalizeTemplateText(row.ban_message_template, DEFAULT_BAN_MESSAGE_TEMPLATE),
    mute_message_template: normalizeTemplateText(row.mute_message_template, DEFAULT_MUTE_MESSAGE_TEMPLATE),
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

export function updateGuildConfig(guildId: string, updates: Partial<GuildConfigRecord>): GuildConfigRecord {
  ensureGuildConfig(guildId);

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
    "kick_message_template",
    "ban_message_template",
    "mute_message_template",
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

    if (key === "kick_message_template") {
      normalized[key] = normalizeTemplateText(rawValue, DEFAULT_KICK_MESSAGE_TEMPLATE);
      continue;
    }

    if (key === "ban_message_template") {
      normalized[key] = normalizeTemplateText(rawValue, DEFAULT_BAN_MESSAGE_TEMPLATE);
      continue;
    }

    if (key === "mute_message_template") {
      normalized[key] = normalizeTemplateText(rawValue, DEFAULT_MUTE_MESSAGE_TEMPLATE);
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
    const sql = `UPDATE guild_config SET ${fields.map((field) => `${field} = @${field}`).join(", ")} WHERE guild_id = @guild_id`;
    sqlite.prepare(sql).run({ guild_id: guildId, ...normalized });
  }

  return getGuildConfig(guildId);
}

export function getRaidGateState(guildId: string): RaidGateRecord {
  const row = sqlite
    .prepare("SELECT gate_active, gate_reason, gate_until, updated_at FROM raid_state WHERE guild_id = ?")
    .get(guildId) as Record<string, unknown> | undefined;

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

export function setRaidGateState(guildId: string, gateActive: boolean, reason: string | null, gateUntil: string | null): RaidGateRecord {
  sqlite
    .prepare(
      `
        INSERT INTO raid_state (guild_id, gate_active, gate_reason, gate_until, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(guild_id)
        DO UPDATE SET
          gate_active = excluded.gate_active,
          gate_reason = excluded.gate_reason,
          gate_until = excluded.gate_until,
          updated_at = excluded.updated_at
      `
    )
    .run(guildId, gateActive ? 1 : 0, reason, gateUntil, nowIso());

  return getRaidGateState(guildId);
}

export function listWarningCounts(guildId: string, limit = 50): WarningRecord[] {
  const normalizedLimit = Math.max(1, Math.min(toInteger(limit, 50), 200));
  const rows = sqlite
    .prepare(
      `
        SELECT CAST(user_id AS TEXT) AS user_id, warning_count, updated_at
        FROM warnings
        WHERE guild_id = ?
        ORDER BY warning_count DESC, updated_at DESC
        LIMIT ?
      `
    )
    .all(guildId, normalizedLimit) as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    user_id: String(toSnowflake(row.user_id) || "0"),
    warning_count: Math.max(0, toInteger(row.warning_count, 0)),
    updated_at: String(row.updated_at || nowIso())
  }));
}

export function listTopLevelMembers(guildId: string, limit = 3): Array<{ user_id: string; level: number; xp: number }> {
  const normalizedLimit = Math.max(1, Math.min(toInteger(limit, 3), 10));
  const rows = sqlite
    .prepare(
      `
        SELECT CAST(user_id AS TEXT) AS user_id, level, xp
        FROM member_levels
        WHERE guild_id = ?
        ORDER BY level DESC, xp DESC, message_count DESC, user_id ASC
        LIMIT ?
      `
    )
    .all(guildId, normalizedLimit) as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    user_id: String(toSnowflake(row.user_id) || "0"),
    level: Math.max(0, toInteger(row.level, 0)),
    xp: Math.max(0, toInteger(row.xp, 0))
  }));
}

export function countTrackedLevelMembers(guildId: string): number {
  const row = sqlite
    .prepare(
      `
        SELECT COUNT(*) AS total_count
        FROM member_levels
        WHERE guild_id = ?
      `
    )
    .get(guildId) as Record<string, unknown>;

  return Math.max(0, toInteger(row?.total_count, 0));
}

export function listCommandToggles(guildId: string): CommandToggleRecord[] {
  const rows = sqlite
    .prepare(
      `
        SELECT command_name, enabled, updated_at
        FROM command_toggles
        WHERE guild_id = ?
        ORDER BY command_name ASC
      `
    )
    .all(guildId) as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    command_name: normalizeCommandName(row.command_name),
    enabled: toBoolean(row.enabled),
    updated_at: String(row.updated_at || nowIso())
  }));
}

export function getCommandStates(guildId: string): CommandToggleRecord[] {
  const persisted = listCommandToggles(guildId);
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

export function setCommandEnabled(guildId: string, commandName: string, enabled: boolean): CommandToggleRecord {
  const normalized = normalizeCommandName(commandName);
  if (!normalized) {
    throw new Error("Invalid command name");
  }

  const updatedAt = nowIso();
  sqlite
    .prepare(
      `
        INSERT INTO command_toggles (guild_id, command_name, enabled, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(guild_id, command_name)
        DO UPDATE SET
          enabled = excluded.enabled,
          updated_at = excluded.updated_at
      `
    )
    .run(guildId, normalized, enabled ? 1 : 0, updatedAt);

  return {
    command_name: normalized,
    enabled,
    updated_at: updatedAt
  };
}

export function getStaffTotpAuth(guildId: string, userId: string): TotpRecord | null {
  const row = sqlite
    .prepare(
      `
        SELECT CAST(guild_id AS TEXT) AS guild_id,
               CAST(user_id AS TEXT) AS user_id,
               secret_base32,
               enabled,
               created_at,
               updated_at,
               last_verified_at
        FROM staff_totp
        WHERE guild_id = ? AND user_id = ?
      `
    )
    .get(guildId, userId) as Record<string, unknown> | undefined;

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

export function upsertStaffTotpAuth(params: {
  guildId: string;
  userId: string;
  secretBase32: string;
  enabled?: boolean;
  lastVerifiedAt?: string | null;
}): TotpRecord {
  const normalizedGuildId = toSnowflake(params.guildId);
  const normalizedUserId = toSnowflake(params.userId);
  const normalizedSecret = String(params.secretBase32 || "")
    .trim()
    .toUpperCase();

  if (!normalizedGuildId || !normalizedUserId || !normalizedSecret) {
    throw new Error("Invalid TOTP payload");
  }

  const now = nowIso();
  sqlite
    .prepare(
      `
        INSERT INTO staff_totp (guild_id, user_id, secret_base32, enabled, created_at, updated_at, last_verified_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(guild_id, user_id)
        DO UPDATE SET
          secret_base32 = excluded.secret_base32,
          enabled = excluded.enabled,
          updated_at = excluded.updated_at,
          last_verified_at = excluded.last_verified_at
      `
    )
    .run(
      normalizedGuildId,
      normalizedUserId,
      normalizedSecret,
      params.enabled === false ? 0 : 1,
      now,
      now,
      params.lastVerifiedAt == null ? null : String(params.lastVerifiedAt)
    );

  const result = getStaffTotpAuth(normalizedGuildId, normalizedUserId);
  if (!result) {
    throw new Error("Failed to upsert TOTP record");
  }

  return result;
}

export function markStaffTotpVerified(guildId: string, userId: string, verifiedAt?: string): TotpRecord | null {
  const now = nowIso();
  const when = verifiedAt ? String(verifiedAt) : now;

  sqlite
    .prepare(
      `
        UPDATE staff_totp
        SET enabled = 1, last_verified_at = ?, updated_at = ?
        WHERE guild_id = ? AND user_id = ?
      `
    )
    .run(when, now, guildId, userId);

  return getStaffTotpAuth(guildId, userId);
}
