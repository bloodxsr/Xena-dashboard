import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { env } from "@/lib/env";
import type {
  CommandToggleRecord,
  GuildConfigRecord,
  ReactionRoleMappingRecord,
  ReactionRolePanelRecord,
  RaidGateRecord,
  TotpRecord,
  WarningRecord
} from "@/lib/types";

const DEFAULT_WELCOME_MESSAGE_TEMPLATE = "Welcome {user.mention} to {guild.name}.";
const DEFAULT_LEVELUP_MESSAGE_TEMPLATE = "Level Up: {user.mention} reached level {level}. Rank #{rank}.";
const DEFAULT_KICK_MESSAGE_TEMPLATE = "You were kicked from {guild.name}. Reason: {reason}.";
const DEFAULT_BAN_MESSAGE_TEMPLATE = "You were banned from {guild.name}. Reason: {reason}.";
const DEFAULT_MUTE_MESSAGE_TEMPLATE = "You were muted in {guild.name}. Reason: {reason}.";
const DEFAULT_LEVEL_CARD_FONT = "default";
const DEFAULT_LEVEL_CARD_PRIMARY_COLOR = "#66f2c4";
const DEFAULT_LEVEL_CARD_ACCENT_COLOR = "#6da8ff";
const DEFAULT_LEVEL_CARD_OVERLAY_OPACITY = 0.38;
const DEFAULT_WELCOME_CARD_TITLE_TEMPLATE = "Welcome to {guild.name}";
const DEFAULT_WELCOME_CARD_SUBTITLE_TEMPLATE = "You're member #{server.member_count}. Read {channels.rules}.";
const DEFAULT_WELCOME_CARD_FONT = "default";
const DEFAULT_WELCOME_CARD_PRIMARY_COLOR = "#f8fafc";
const DEFAULT_WELCOME_CARD_ACCENT_COLOR = "#6dd6ff";
const DEFAULT_WELCOME_CARD_OVERLAY_OPACITY = 0.48;
const DEFAULT_TICKET_TRIGGER_EMOJI = "🎫";
const DEFAULT_TICKET_WELCOME_TEMPLATE =
  "Hello {user.mention}, thanks for opening a ticket. Our team will be with you soon.";
const DEPRECATED_TOGGLEABLE_COMMANDS = new Set([
  "reactionroleadd",
  "reactionroleclear",
  "reactionrolelist",
  "reactionroleremove"
]);

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

function normalizeColor(value: unknown, fallback: string): string {
  const text = String(value ?? "").trim();
  if (/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(text)) {
    return text.toLowerCase();
  }

  return fallback;
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
      level_card_font TEXT NOT NULL DEFAULT 'default',
      level_card_primary_color TEXT NOT NULL DEFAULT '#66f2c4',
      level_card_accent_color TEXT NOT NULL DEFAULT '#6da8ff',
      level_card_background_url TEXT,
      level_card_overlay_opacity REAL NOT NULL DEFAULT 0.38,
      welcome_card_enabled INTEGER NOT NULL DEFAULT 0,
      welcome_card_title_template TEXT,
      welcome_card_subtitle_template TEXT,
      welcome_card_font TEXT NOT NULL DEFAULT 'default',
      welcome_card_primary_color TEXT NOT NULL DEFAULT '#f8fafc',
      welcome_card_accent_color TEXT NOT NULL DEFAULT '#6dd6ff',
      welcome_card_background_url TEXT,
      welcome_card_overlay_opacity REAL NOT NULL DEFAULT 0.48,
      ticket_enabled INTEGER NOT NULL DEFAULT 0,
      ticket_trigger_channel_id INTEGER,
      ticket_trigger_message_id INTEGER,
      ticket_trigger_emoji TEXT NOT NULL DEFAULT '🎫',
      ticket_category_channel_id INTEGER,
      ticket_support_role_id INTEGER,
      ticket_welcome_template TEXT,
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

    CREATE TABLE IF NOT EXISTS reaction_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id INTEGER NOT NULL,
      channel_id INTEGER NOT NULL,
      message_id INTEGER NOT NULL,
      emoji_key TEXT NOT NULL,
      emoji_display TEXT NOT NULL,
      role_id INTEGER NOT NULL,
      created_by_user_id INTEGER,
      created_at TEXT NOT NULL,
      UNIQUE (guild_id, channel_id, message_id, emoji_key, role_id)
    );

    CREATE TABLE IF NOT EXISTS reaction_role_panels (
      guild_id INTEGER NOT NULL,
      channel_id INTEGER NOT NULL,
      message_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (guild_id, message_id)
    );
  `);

  ensureTableColumn(database, "guild_config", "welcome_message_template", "TEXT");
  ensureTableColumn(database, "guild_config", "levelup_message_template", "TEXT");
  ensureTableColumn(database, "guild_config", "kick_message_template", "TEXT");
  ensureTableColumn(database, "guild_config", "ban_message_template", "TEXT");
  ensureTableColumn(database, "guild_config", "mute_message_template", "TEXT");
  ensureTableColumn(database, "guild_config", "level_card_font", "TEXT NOT NULL DEFAULT 'default'");
  ensureTableColumn(database, "guild_config", "level_card_primary_color", "TEXT NOT NULL DEFAULT '#66f2c4'");
  ensureTableColumn(database, "guild_config", "level_card_accent_color", "TEXT NOT NULL DEFAULT '#6da8ff'");
  ensureTableColumn(database, "guild_config", "level_card_background_url", "TEXT");
  ensureTableColumn(database, "guild_config", "level_card_overlay_opacity", "REAL NOT NULL DEFAULT 0.38");
  ensureTableColumn(database, "guild_config", "welcome_card_enabled", "INTEGER NOT NULL DEFAULT 0");
  ensureTableColumn(database, "guild_config", "welcome_card_title_template", "TEXT");
  ensureTableColumn(database, "guild_config", "welcome_card_subtitle_template", "TEXT");
  ensureTableColumn(database, "guild_config", "welcome_card_font", "TEXT NOT NULL DEFAULT 'default'");
  ensureTableColumn(database, "guild_config", "welcome_card_primary_color", "TEXT NOT NULL DEFAULT '#f8fafc'");
  ensureTableColumn(database, "guild_config", "welcome_card_accent_color", "TEXT NOT NULL DEFAULT '#6dd6ff'");
  ensureTableColumn(database, "guild_config", "welcome_card_background_url", "TEXT");
  ensureTableColumn(database, "guild_config", "welcome_card_overlay_opacity", "REAL NOT NULL DEFAULT 0.48");
  ensureTableColumn(database, "guild_config", "ticket_enabled", "INTEGER NOT NULL DEFAULT 0");
  ensureTableColumn(database, "guild_config", "ticket_trigger_channel_id", "INTEGER");
  ensureTableColumn(database, "guild_config", "ticket_trigger_message_id", "INTEGER");
  ensureTableColumn(database, "guild_config", "ticket_trigger_emoji", "TEXT NOT NULL DEFAULT '🎫'");
  ensureTableColumn(database, "guild_config", "ticket_category_channel_id", "INTEGER");
  ensureTableColumn(database, "guild_config", "ticket_support_role_id", "INTEGER");
  ensureTableColumn(database, "guild_config", "ticket_welcome_template", "TEXT");

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_reaction_roles_lookup
    ON reaction_roles (guild_id, channel_id, message_id, emoji_key);

    CREATE INDEX IF NOT EXISTS idx_reaction_role_panels_lookup
    ON reaction_role_panels (guild_id, channel_id, message_id);
  `);

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
  database
    .prepare(
      "UPDATE guild_config SET welcome_card_title_template = ? WHERE welcome_card_title_template IS NULL OR TRIM(welcome_card_title_template) = ''"
    )
    .run(DEFAULT_WELCOME_CARD_TITLE_TEMPLATE);
  database
    .prepare(
      "UPDATE guild_config SET welcome_card_subtitle_template = ? WHERE welcome_card_subtitle_template IS NULL OR TRIM(welcome_card_subtitle_template) = ''"
    )
    .run(DEFAULT_WELCOME_CARD_SUBTITLE_TEMPLATE);
  database
    .prepare(
      "UPDATE guild_config SET ticket_trigger_emoji = ? WHERE ticket_trigger_emoji IS NULL OR TRIM(ticket_trigger_emoji) = ''"
    )
    .run(DEFAULT_TICKET_TRIGGER_EMOJI);
  database
    .prepare(
      "UPDATE guild_config SET ticket_welcome_template = ? WHERE ticket_welcome_template IS NULL OR TRIM(ticket_welcome_template) = ''"
    )
    .run(DEFAULT_TICKET_WELCOME_TEMPLATE);
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
    level_card_font: String(row.level_card_font || DEFAULT_LEVEL_CARD_FONT),
    level_card_primary_color: normalizeColor(row.level_card_primary_color, DEFAULT_LEVEL_CARD_PRIMARY_COLOR),
    level_card_accent_color: normalizeColor(row.level_card_accent_color, DEFAULT_LEVEL_CARD_ACCENT_COLOR),
    level_card_background_url: row.level_card_background_url ? String(row.level_card_background_url) : null,
    level_card_overlay_opacity: Math.max(0, Math.min(toFloat(row.level_card_overlay_opacity, DEFAULT_LEVEL_CARD_OVERLAY_OPACITY), 1)),
    welcome_card_enabled: toBoolean(row.welcome_card_enabled),
    welcome_card_title_template: normalizeTemplateText(row.welcome_card_title_template, DEFAULT_WELCOME_CARD_TITLE_TEMPLATE),
    welcome_card_subtitle_template: normalizeTemplateText(row.welcome_card_subtitle_template, DEFAULT_WELCOME_CARD_SUBTITLE_TEMPLATE),
    welcome_card_font: String(row.welcome_card_font || DEFAULT_WELCOME_CARD_FONT),
    welcome_card_primary_color: normalizeColor(row.welcome_card_primary_color, DEFAULT_WELCOME_CARD_PRIMARY_COLOR),
    welcome_card_accent_color: normalizeColor(row.welcome_card_accent_color, DEFAULT_WELCOME_CARD_ACCENT_COLOR),
    welcome_card_background_url: row.welcome_card_background_url ? String(row.welcome_card_background_url) : null,
    welcome_card_overlay_opacity: Math.max(0, Math.min(toFloat(row.welcome_card_overlay_opacity, DEFAULT_WELCOME_CARD_OVERLAY_OPACITY), 1)),
    ticket_enabled: toBoolean(row.ticket_enabled),
    ticket_trigger_channel_id: toSnowflake(row.ticket_trigger_channel_id),
    ticket_trigger_message_id: toSnowflake(row.ticket_trigger_message_id),
    ticket_trigger_emoji: String(row.ticket_trigger_emoji || DEFAULT_TICKET_TRIGGER_EMOJI),
    ticket_category_channel_id: toSnowflake(row.ticket_category_channel_id),
    ticket_support_role_id: toSnowflake(row.ticket_support_role_id),
    ticket_welcome_template: normalizeTemplateText(row.ticket_welcome_template, DEFAULT_TICKET_WELCOME_TEMPLATE),
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
    "level_card_font",
    "level_card_primary_color",
    "level_card_accent_color",
    "level_card_background_url",
    "level_card_overlay_opacity",
    "welcome_card_enabled",
    "welcome_card_title_template",
    "welcome_card_subtitle_template",
    "welcome_card_font",
    "welcome_card_primary_color",
    "welcome_card_accent_color",
    "welcome_card_background_url",
    "welcome_card_overlay_opacity",
    "ticket_enabled",
    "ticket_trigger_channel_id",
    "ticket_trigger_message_id",
    "ticket_trigger_emoji",
    "ticket_category_channel_id",
    "ticket_support_role_id",
    "ticket_welcome_template",
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

    if (key === "ticket_trigger_message_id" || key === "ticket_support_role_id") {
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

    if (key === "welcome_card_title_template") {
      normalized[key] = normalizeTemplateText(rawValue, DEFAULT_WELCOME_CARD_TITLE_TEMPLATE);
      continue;
    }

    if (key === "welcome_card_subtitle_template") {
      normalized[key] = normalizeTemplateText(rawValue, DEFAULT_WELCOME_CARD_SUBTITLE_TEMPLATE);
      continue;
    }

    if (key === "ticket_welcome_template") {
      normalized[key] = normalizeTemplateText(rawValue, DEFAULT_TICKET_WELCOME_TEMPLATE);
      continue;
    }

    if (key === "level_card_font") {
      const text = String(rawValue ?? "").trim().toLowerCase();
      normalized[key] = text || DEFAULT_LEVEL_CARD_FONT;
      continue;
    }

    if (key === "welcome_card_font") {
      const text = String(rawValue ?? "").trim().toLowerCase();
      normalized[key] = text || DEFAULT_WELCOME_CARD_FONT;
      continue;
    }

    if (key === "level_card_primary_color") {
      normalized[key] = normalizeColor(rawValue, DEFAULT_LEVEL_CARD_PRIMARY_COLOR);
      continue;
    }

    if (key === "level_card_accent_color") {
      normalized[key] = normalizeColor(rawValue, DEFAULT_LEVEL_CARD_ACCENT_COLOR);
      continue;
    }

    if (key === "welcome_card_primary_color") {
      normalized[key] = normalizeColor(rawValue, DEFAULT_WELCOME_CARD_PRIMARY_COLOR);
      continue;
    }

    if (key === "welcome_card_accent_color") {
      normalized[key] = normalizeColor(rawValue, DEFAULT_WELCOME_CARD_ACCENT_COLOR);
      continue;
    }

    if (key === "level_card_background_url" || key === "welcome_card_background_url") {
      const text = String(rawValue ?? "").trim();
      normalized[key] = text || null;
      continue;
    }

    if (key === "level_card_overlay_opacity") {
      normalized[key] = Math.max(0, Math.min(toFloat(rawValue, DEFAULT_LEVEL_CARD_OVERLAY_OPACITY), 1));
      continue;
    }

    if (key === "welcome_card_overlay_opacity") {
      normalized[key] = Math.max(0, Math.min(toFloat(rawValue, DEFAULT_WELCOME_CARD_OVERLAY_OPACITY), 1));
      continue;
    }

    if (key === "welcome_card_enabled" || key === "ticket_enabled") {
      normalized[key] = toBoolean(rawValue);
      continue;
    }

    if (key === "ticket_trigger_emoji") {
      const text = String(rawValue ?? "").trim();
      normalized[key] = text || DEFAULT_TICKET_TRIGGER_EMOJI;
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

  return seeded
    .filter((row) => !DEPRECATED_TOGGLEABLE_COMMANDS.has(row.command_name))
    .sort((a, b) => a.command_name.localeCompare(b.command_name));
}

export function setCommandEnabled(guildId: string, commandName: string, enabled: boolean): CommandToggleRecord {
  const normalized = normalizeCommandName(commandName);
  if (!normalized) {
    throw new Error("Invalid command name");
  }

  if (DEPRECATED_TOGGLEABLE_COMMANDS.has(normalized)) {
    throw new Error("Legacy reaction-role commands are dashboard-managed and cannot be toggled.");
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

type ReactionRolePanelCreateInput = {
  channelId: string;
  messageId: string;
  content: string;
  mappings: Array<{
    emojiKey: string;
    emojiDisplay: string;
    roleId: string;
  }>;
  createdByUserId?: string | null;
};

function getReactionRolePanelByMessage(guildId: string, messageId: string): ReactionRolePanelRecord | null {
  const panelRow = sqlite
    .prepare(
      `
        SELECT CAST(guild_id AS TEXT) AS guild_id,
               CAST(channel_id AS TEXT) AS channel_id,
               CAST(message_id AS TEXT) AS message_id,
               content,
               created_at,
               updated_at
        FROM reaction_role_panels
        WHERE guild_id = ? AND message_id = ?
        LIMIT 1
      `
    )
    .get(guildId, messageId) as Record<string, unknown> | undefined;

  if (!panelRow) {
    return null;
  }

  const mappings = sqlite
    .prepare(
      `
        SELECT CAST(guild_id AS TEXT) AS guild_id,
               CAST(channel_id AS TEXT) AS channel_id,
               CAST(message_id AS TEXT) AS message_id,
               emoji_key,
               emoji_display,
               CAST(role_id AS TEXT) AS role_id,
               created_at
        FROM reaction_roles
        WHERE guild_id = ? AND message_id = ?
        ORDER BY created_at ASC, emoji_display ASC, role_id ASC
      `
    )
    .all(guildId, messageId) as Array<Record<string, unknown>>;

  return {
    guild_id: String(toSnowflake(panelRow.guild_id) || guildId),
    channel_id: String(toSnowflake(panelRow.channel_id) || "0"),
    message_id: String(toSnowflake(panelRow.message_id) || messageId),
    content: String(panelRow.content || ""),
    created_at: String(panelRow.created_at || nowIso()),
    updated_at: String(panelRow.updated_at || nowIso()),
    mappings: mappings
      .map((row) => {
        const normalizedRoleId = toSnowflake(row.role_id);
        const normalizedChannelId = toSnowflake(row.channel_id);
        const normalizedMessageId = toSnowflake(row.message_id);
        const emojiKey = String(row.emoji_key || "").trim();
        const emojiDisplay = String(row.emoji_display || "").trim();

        if (!normalizedRoleId || !normalizedChannelId || !normalizedMessageId || !emojiKey || !emojiDisplay) {
          return null;
        }

        const mapped: ReactionRoleMappingRecord = {
          guild_id: String(toSnowflake(row.guild_id) || guildId),
          channel_id: normalizedChannelId,
          message_id: normalizedMessageId,
          emoji_key: emojiKey,
          emoji_display: emojiDisplay,
          role_id: normalizedRoleId,
          created_at: String(row.created_at || nowIso())
        };

        return mapped;
      })
      .filter((item): item is ReactionRoleMappingRecord => Boolean(item))
  };
}

export function listReactionRolePanels(guildId: string): ReactionRolePanelRecord[] {
  const normalizedGuildId = toSnowflake(guildId);
  if (!normalizedGuildId) {
    return [];
  }

  const panelRows = sqlite
    .prepare(
      `
        SELECT CAST(guild_id AS TEXT) AS guild_id,
               CAST(channel_id AS TEXT) AS channel_id,
               CAST(message_id AS TEXT) AS message_id,
               content,
               created_at,
               updated_at
        FROM reaction_role_panels
        WHERE guild_id = ?
        ORDER BY updated_at DESC, created_at DESC
      `
    )
    .all(normalizedGuildId) as Array<Record<string, unknown>>;

  const mappingRows = sqlite
    .prepare(
      `
        SELECT CAST(guild_id AS TEXT) AS guild_id,
               CAST(channel_id AS TEXT) AS channel_id,
               CAST(message_id AS TEXT) AS message_id,
               emoji_key,
               emoji_display,
               CAST(role_id AS TEXT) AS role_id,
               created_at
        FROM reaction_roles
        WHERE guild_id = ?
        ORDER BY message_id ASC, created_at ASC, emoji_display ASC, role_id ASC
      `
    )
    .all(normalizedGuildId) as Array<Record<string, unknown>>;

  const mappingsByMessageId = new Map<string, ReactionRoleMappingRecord[]>();
  for (const row of mappingRows) {
    const normalizedRoleId = toSnowflake(row.role_id);
    const normalizedChannelId = toSnowflake(row.channel_id);
    const normalizedMessageId = toSnowflake(row.message_id);
    const emojiKey = String(row.emoji_key || "").trim();
    const emojiDisplay = String(row.emoji_display || "").trim();

    if (!normalizedRoleId || !normalizedChannelId || !normalizedMessageId || !emojiKey || !emojiDisplay) {
      continue;
    }

    const mapped: ReactionRoleMappingRecord = {
      guild_id: String(toSnowflake(row.guild_id) || normalizedGuildId),
      channel_id: normalizedChannelId,
      message_id: normalizedMessageId,
      emoji_key: emojiKey,
      emoji_display: emojiDisplay,
      role_id: normalizedRoleId,
      created_at: String(row.created_at || nowIso())
    };

    const list = mappingsByMessageId.get(normalizedMessageId) || [];
    list.push(mapped);
    mappingsByMessageId.set(normalizedMessageId, list);
  }

  return panelRows
    .map((row) => {
      const panelMessageId = toSnowflake(row.message_id);
      const panelChannelId = toSnowflake(row.channel_id);
      if (!panelMessageId || !panelChannelId) {
        return null;
      }

      const panel: ReactionRolePanelRecord = {
        guild_id: String(toSnowflake(row.guild_id) || normalizedGuildId),
        channel_id: panelChannelId,
        message_id: panelMessageId,
        content: String(row.content || ""),
        created_at: String(row.created_at || nowIso()),
        updated_at: String(row.updated_at || nowIso()),
        mappings: mappingsByMessageId.get(panelMessageId) || []
      };

      return panel;
    })
    .filter((panel): panel is ReactionRolePanelRecord => Boolean(panel));
}

export function createReactionRolePanel(guildId: string, input: ReactionRolePanelCreateInput): ReactionRolePanelRecord {
  const normalizedGuildId = toSnowflake(guildId);
  const normalizedChannelId = toSnowflake(input.channelId);
  const normalizedMessageId = toSnowflake(input.messageId);

  if (!normalizedGuildId || !normalizedChannelId || !normalizedMessageId) {
    throw new Error("Invalid reaction role panel identifiers");
  }

  const content = String(input.content ?? "").trim();
  const mappingSource = Array.isArray(input.mappings) ? input.mappings : [];
  if (mappingSource.length === 0) {
    throw new Error("At least one reaction role mapping is required");
  }

  const uniqueMappings = new Map<string, { emojiKey: string; emojiDisplay: string; roleId: string }>();
  for (const rawMapping of mappingSource) {
    const emojiKey = String(rawMapping?.emojiKey || "").trim();
    const emojiDisplay = String(rawMapping?.emojiDisplay || "").trim();
    const roleId = toSnowflake(rawMapping?.roleId);
    if (!emojiKey || !emojiDisplay || !roleId) {
      continue;
    }

    uniqueMappings.set(`${emojiKey}:${roleId}`, {
      emojiKey,
      emojiDisplay,
      roleId
    });
  }

  const mappings = [...uniqueMappings.values()];
  if (mappings.length === 0) {
    throw new Error("No valid reaction role mappings were provided");
  }

  const createdByUserId = toSnowflake(input.createdByUserId);
  const timestamp = nowIso();

  const transaction = sqlite.transaction(() => {
    sqlite
      .prepare(
        `
          INSERT INTO reaction_role_panels (guild_id, channel_id, message_id, content, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(guild_id, message_id)
          DO UPDATE SET
            channel_id = excluded.channel_id,
            content = excluded.content,
            updated_at = excluded.updated_at
        `
      )
      .run(normalizedGuildId, normalizedChannelId, normalizedMessageId, content, timestamp, timestamp);

    sqlite
      .prepare(
        `
          DELETE FROM reaction_roles
          WHERE guild_id = ? AND message_id = ?
        `
      )
      .run(normalizedGuildId, normalizedMessageId);

    const insertMapping = sqlite.prepare(
      `
        INSERT OR IGNORE INTO reaction_roles (
          guild_id,
          channel_id,
          message_id,
          emoji_key,
          emoji_display,
          role_id,
          created_by_user_id,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
    );

    for (const mapping of mappings) {
      insertMapping.run(
        normalizedGuildId,
        normalizedChannelId,
        normalizedMessageId,
        mapping.emojiKey,
        mapping.emojiDisplay,
        mapping.roleId,
        createdByUserId,
        timestamp
      );
    }
  });

  transaction();

  const panel = getReactionRolePanelByMessage(normalizedGuildId, normalizedMessageId);
  if (!panel) {
    throw new Error("Failed to persist reaction role panel");
  }

  return panel;
}

export function deleteReactionRolePanel(guildId: string, messageId: string): boolean {
  const normalizedGuildId = toSnowflake(guildId);
  const normalizedMessageId = toSnowflake(messageId);
  if (!normalizedGuildId || !normalizedMessageId) {
    throw new Error("Invalid reaction role panel identifiers");
  }

  const transaction = sqlite.transaction(() => {
    const removeMappings = sqlite
      .prepare(
        `
          DELETE FROM reaction_roles
          WHERE guild_id = ? AND message_id = ?
        `
      )
      .run(normalizedGuildId, normalizedMessageId);

    const removePanel = sqlite
      .prepare(
        `
          DELETE FROM reaction_role_panels
          WHERE guild_id = ? AND message_id = ?
        `
      )
      .run(normalizedGuildId, normalizedMessageId);

    return removeMappings.changes > 0 || removePanel.changes > 0;
  });

  return transaction();
}
