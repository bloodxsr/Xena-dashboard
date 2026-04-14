import { Pool, type QueryResultRow } from "pg";

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

function normalizeColor(value: unknown, fallback: string): string {
  const text = String(value ?? "").trim();
  if (/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(text)) {
    return text.toLowerCase();
  }

  return fallback;
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
      kick_message_template TEXT NULL,
      ban_message_template TEXT NULL,
      mute_message_template TEXT NULL,
      level_card_font VARCHAR(40) NOT NULL DEFAULT 'default',
      level_card_primary_color VARCHAR(9) NOT NULL DEFAULT '#66f2c4',
      level_card_accent_color VARCHAR(9) NOT NULL DEFAULT '#6da8ff',
      level_card_background_url TEXT NULL,
      level_card_overlay_opacity DOUBLE PRECISION NOT NULL DEFAULT 0.38,
      welcome_card_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      welcome_card_title_template TEXT NULL,
      welcome_card_subtitle_template TEXT NULL,
      welcome_card_font VARCHAR(40) NOT NULL DEFAULT 'default',
      welcome_card_primary_color VARCHAR(9) NOT NULL DEFAULT '#f8fafc',
      welcome_card_accent_color VARCHAR(9) NOT NULL DEFAULT '#6dd6ff',
      welcome_card_background_url TEXT NULL,
      welcome_card_overlay_opacity DOUBLE PRECISION NOT NULL DEFAULT 0.48,
      ticket_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      ticket_trigger_channel_id VARCHAR(22) NULL,
      ticket_trigger_message_id VARCHAR(22) NULL,
      ticket_trigger_emoji VARCHAR(60) NOT NULL DEFAULT '🎫',
      ticket_category_channel_id VARCHAR(22) NULL,
      ticket_support_role_id VARCHAR(22) NULL,
      ticket_welcome_template TEXT NULL,
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

  await execute(`
    CREATE TABLE IF NOT EXISTS reaction_roles (
      id BIGSERIAL PRIMARY KEY,
      guild_id VARCHAR(22) NOT NULL,
      channel_id VARCHAR(22) NOT NULL,
      message_id VARCHAR(22) NOT NULL,
      emoji_key TEXT NOT NULL,
      emoji_display TEXT NOT NULL,
      role_id VARCHAR(22) NOT NULL,
      created_by_user_id VARCHAR(22) NULL,
      created_at VARCHAR(64) NOT NULL,
      UNIQUE (guild_id, channel_id, message_id, emoji_key, role_id)
    )
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS reaction_role_panels (
      guild_id VARCHAR(22) NOT NULL,
      channel_id VARCHAR(22) NOT NULL,
      message_id VARCHAR(22) NOT NULL,
      content TEXT NOT NULL,
      created_at VARCHAR(64) NOT NULL,
      updated_at VARCHAR(64) NOT NULL,
      PRIMARY KEY (guild_id, message_id)
    )
  `);

  await ensureTableColumn("guild_config", "welcome_message_template", "TEXT NULL");
  await ensureTableColumn("guild_config", "levelup_message_template", "TEXT NULL");
  await ensureTableColumn("guild_config", "kick_message_template", "TEXT NULL");
  await ensureTableColumn("guild_config", "ban_message_template", "TEXT NULL");
  await ensureTableColumn("guild_config", "mute_message_template", "TEXT NULL");
  await ensureTableColumn("guild_config", "level_card_font", "VARCHAR(40) NOT NULL DEFAULT 'default'");
  await ensureTableColumn("guild_config", "level_card_primary_color", "VARCHAR(9) NOT NULL DEFAULT '#66f2c4'");
  await ensureTableColumn("guild_config", "level_card_accent_color", "VARCHAR(9) NOT NULL DEFAULT '#6da8ff'");
  await ensureTableColumn("guild_config", "level_card_background_url", "TEXT NULL");
  await ensureTableColumn("guild_config", "level_card_overlay_opacity", "DOUBLE PRECISION NOT NULL DEFAULT 0.38");
  await ensureTableColumn("guild_config", "welcome_card_enabled", "BOOLEAN NOT NULL DEFAULT FALSE");
  await ensureTableColumn("guild_config", "welcome_card_title_template", "TEXT NULL");
  await ensureTableColumn("guild_config", "welcome_card_subtitle_template", "TEXT NULL");
  await ensureTableColumn("guild_config", "welcome_card_font", "VARCHAR(40) NOT NULL DEFAULT 'default'");
  await ensureTableColumn("guild_config", "welcome_card_primary_color", "VARCHAR(9) NOT NULL DEFAULT '#f8fafc'");
  await ensureTableColumn("guild_config", "welcome_card_accent_color", "VARCHAR(9) NOT NULL DEFAULT '#6dd6ff'");
  await ensureTableColumn("guild_config", "welcome_card_background_url", "TEXT NULL");
  await ensureTableColumn("guild_config", "welcome_card_overlay_opacity", "DOUBLE PRECISION NOT NULL DEFAULT 0.48");
  await ensureTableColumn("guild_config", "ticket_enabled", "BOOLEAN NOT NULL DEFAULT FALSE");
  await ensureTableColumn("guild_config", "ticket_trigger_channel_id", "VARCHAR(22) NULL");
  await ensureTableColumn("guild_config", "ticket_trigger_message_id", "VARCHAR(22) NULL");
  await ensureTableColumn("guild_config", "ticket_trigger_emoji", "VARCHAR(60) NOT NULL DEFAULT '🎫'");
  await ensureTableColumn("guild_config", "ticket_category_channel_id", "VARCHAR(22) NULL");
  await ensureTableColumn("guild_config", "ticket_support_role_id", "VARCHAR(22) NULL");
  await ensureTableColumn("guild_config", "ticket_welcome_template", "TEXT NULL");

  await execute(
    "CREATE INDEX IF NOT EXISTS idx_reaction_roles_lookup ON reaction_roles (guild_id, channel_id, message_id, emoji_key)"
  );
  await execute(
    "CREATE INDEX IF NOT EXISTS idx_reaction_role_panels_lookup ON reaction_role_panels (guild_id, channel_id, message_id)"
  );

  await execute(
    "UPDATE guild_config SET welcome_message_template = $1 WHERE welcome_message_template IS NULL OR TRIM(welcome_message_template) = ''",
    [DEFAULT_WELCOME_MESSAGE_TEMPLATE]
  );
  await execute(
    "UPDATE guild_config SET levelup_message_template = $1 WHERE levelup_message_template IS NULL OR TRIM(levelup_message_template) = ''",
    [DEFAULT_LEVELUP_MESSAGE_TEMPLATE]
  );
  await execute(
    "UPDATE guild_config SET kick_message_template = $1 WHERE kick_message_template IS NULL OR TRIM(kick_message_template) = ''",
    [DEFAULT_KICK_MESSAGE_TEMPLATE]
  );
  await execute(
    "UPDATE guild_config SET ban_message_template = $1 WHERE ban_message_template IS NULL OR TRIM(ban_message_template) = ''",
    [DEFAULT_BAN_MESSAGE_TEMPLATE]
  );
  await execute(
    "UPDATE guild_config SET mute_message_template = $1 WHERE mute_message_template IS NULL OR TRIM(mute_message_template) = ''",
    [DEFAULT_MUTE_MESSAGE_TEMPLATE]
  );
  await execute(
    "UPDATE guild_config SET welcome_card_title_template = $1 WHERE welcome_card_title_template IS NULL OR TRIM(welcome_card_title_template) = ''",
    [DEFAULT_WELCOME_CARD_TITLE_TEMPLATE]
  );
  await execute(
    "UPDATE guild_config SET welcome_card_subtitle_template = $1 WHERE welcome_card_subtitle_template IS NULL OR TRIM(welcome_card_subtitle_template) = ''",
    [DEFAULT_WELCOME_CARD_SUBTITLE_TEMPLATE]
  );
  await execute(
    "UPDATE guild_config SET ticket_trigger_emoji = $1 WHERE ticket_trigger_emoji IS NULL OR TRIM(ticket_trigger_emoji) = ''",
    [DEFAULT_TICKET_TRIGGER_EMOJI]
  );
  await execute(
    "UPDATE guild_config SET ticket_welcome_template = $1 WHERE ticket_welcome_template IS NULL OR TRIM(ticket_welcome_template) = ''",
    [DEFAULT_TICKET_WELCOME_TEMPLATE]
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
    kick_message_template: normalizeTemplateText(
      row.kick_message_template,
      DEFAULT_KICK_MESSAGE_TEMPLATE
    ),
    ban_message_template: normalizeTemplateText(
      row.ban_message_template,
      DEFAULT_BAN_MESSAGE_TEMPLATE
    ),
    mute_message_template: normalizeTemplateText(
      row.mute_message_template,
      DEFAULT_MUTE_MESSAGE_TEMPLATE
    ),
    level_card_font: String(row.level_card_font || DEFAULT_LEVEL_CARD_FONT),
    level_card_primary_color: normalizeColor(row.level_card_primary_color, DEFAULT_LEVEL_CARD_PRIMARY_COLOR),
    level_card_accent_color: normalizeColor(row.level_card_accent_color, DEFAULT_LEVEL_CARD_ACCENT_COLOR),
    level_card_background_url: row.level_card_background_url ? String(row.level_card_background_url) : null,
    level_card_overlay_opacity: Math.max(0, Math.min(toFloat(row.level_card_overlay_opacity, DEFAULT_LEVEL_CARD_OVERLAY_OPACITY), 1)),
    welcome_card_enabled: toBoolean(row.welcome_card_enabled),
    welcome_card_title_template: normalizeTemplateText(
      row.welcome_card_title_template,
      DEFAULT_WELCOME_CARD_TITLE_TEMPLATE
    ),
    welcome_card_subtitle_template: normalizeTemplateText(
      row.welcome_card_subtitle_template,
      DEFAULT_WELCOME_CARD_SUBTITLE_TEMPLATE
    ),
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

  return seeded
    .filter((row) => !DEPRECATED_TOGGLEABLE_COMMANDS.has(row.command_name))
    .sort((a, b) => a.command_name.localeCompare(b.command_name));
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

  if (DEPRECATED_TOGGLEABLE_COMMANDS.has(normalized)) {
    throw new Error("Legacy reaction-role commands are dashboard-managed and cannot be toggled.");
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

async function getReactionRolePanelByMessage(
  guildId: string,
  messageId: string
): Promise<ReactionRolePanelRecord | null> {
  const panelRows = await queryRows<Record<string, unknown>>(
    `
      SELECT guild_id, channel_id, message_id, content, created_at, updated_at
      FROM reaction_role_panels
      WHERE guild_id = $1 AND message_id = $2
      LIMIT 1
    `,
    [guildId, messageId]
  );
  const panelRow = panelRows[0];
  if (!panelRow) {
    return null;
  }

  const mappingRows = await queryRows<Record<string, unknown>>(
    `
      SELECT guild_id, channel_id, message_id, emoji_key, emoji_display, role_id, created_at
      FROM reaction_roles
      WHERE guild_id = $1 AND message_id = $2
      ORDER BY created_at ASC, emoji_display ASC, role_id ASC
    `,
    [guildId, messageId]
  );

  const mappings = mappingRows
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
    .filter((item): item is ReactionRoleMappingRecord => Boolean(item));

  const normalizedChannelId = toSnowflake(panelRow.channel_id);
  const normalizedMessageId = toSnowflake(panelRow.message_id);
  if (!normalizedChannelId || !normalizedMessageId) {
    return null;
  }

  return {
    guild_id: String(toSnowflake(panelRow.guild_id) || guildId),
    channel_id: normalizedChannelId,
    message_id: normalizedMessageId,
    content: String(panelRow.content || ""),
    created_at: String(panelRow.created_at || nowIso()),
    updated_at: String(panelRow.updated_at || nowIso()),
    mappings
  };
}

export async function listReactionRolePanels(guildId: string): Promise<ReactionRolePanelRecord[]> {
  await ensureInitialized();
  const normalizedGuildId = toSnowflake(guildId);
  if (!normalizedGuildId) {
    return [];
  }

  const panelRows = await queryRows<Record<string, unknown>>(
    `
      SELECT guild_id, channel_id, message_id, content, created_at, updated_at
      FROM reaction_role_panels
      WHERE guild_id = $1
      ORDER BY updated_at DESC, created_at DESC
    `,
    [normalizedGuildId]
  );

  const mappingRows = await queryRows<Record<string, unknown>>(
    `
      SELECT guild_id, channel_id, message_id, emoji_key, emoji_display, role_id, created_at
      FROM reaction_roles
      WHERE guild_id = $1
      ORDER BY message_id ASC, created_at ASC, emoji_display ASC, role_id ASC
    `,
    [normalizedGuildId]
  );

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
      const normalizedChannelId = toSnowflake(row.channel_id);
      const normalizedMessageId = toSnowflake(row.message_id);
      if (!normalizedChannelId || !normalizedMessageId) {
        return null;
      }

      const panel: ReactionRolePanelRecord = {
        guild_id: String(toSnowflake(row.guild_id) || normalizedGuildId),
        channel_id: normalizedChannelId,
        message_id: normalizedMessageId,
        content: String(row.content || ""),
        created_at: String(row.created_at || nowIso()),
        updated_at: String(row.updated_at || nowIso()),
        mappings: mappingsByMessageId.get(normalizedMessageId) || []
      };

      return panel;
    })
    .filter((panel): panel is ReactionRolePanelRecord => Boolean(panel));
}

export async function createReactionRolePanel(
  guildId: string,
  input: ReactionRolePanelCreateInput
): Promise<ReactionRolePanelRecord> {
  await ensureInitialized();
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
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    await client.query(
      `
        INSERT INTO reaction_role_panels (guild_id, channel_id, message_id, content, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $5)
        ON CONFLICT (guild_id, message_id) DO UPDATE SET
          channel_id = EXCLUDED.channel_id,
          content = EXCLUDED.content,
          updated_at = EXCLUDED.updated_at
      `,
      [normalizedGuildId, normalizedChannelId, normalizedMessageId, content, timestamp]
    );

    await client.query(
      `
        DELETE FROM reaction_roles
        WHERE guild_id = $1 AND message_id = $2
      `,
      [normalizedGuildId, normalizedMessageId]
    );

    for (const mapping of mappings) {
      await client.query(
        `
          INSERT INTO reaction_roles (
            guild_id,
            channel_id,
            message_id,
            emoji_key,
            emoji_display,
            role_id,
            created_by_user_id,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (guild_id, channel_id, message_id, emoji_key, role_id)
          DO NOTHING
        `,
        [
          normalizedGuildId,
          normalizedChannelId,
          normalizedMessageId,
          mapping.emojiKey,
          mapping.emojiDisplay,
          mapping.roleId,
          createdByUserId,
          timestamp
        ]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const panel = await getReactionRolePanelByMessage(normalizedGuildId, normalizedMessageId);
  if (!panel) {
    throw new Error("Failed to persist reaction role panel");
  }

  return panel;
}

export async function deleteReactionRolePanel(guildId: string, messageId: string): Promise<boolean> {
  await ensureInitialized();
  const normalizedGuildId = toSnowflake(guildId);
  const normalizedMessageId = toSnowflake(messageId);
  if (!normalizedGuildId || !normalizedMessageId) {
    throw new Error("Invalid reaction role panel identifiers");
  }

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const mappingResult = await client.query(
      `
        DELETE FROM reaction_roles
        WHERE guild_id = $1 AND message_id = $2
      `,
      [normalizedGuildId, normalizedMessageId]
    );

    const panelResult = await client.query(
      `
        DELETE FROM reaction_role_panels
        WHERE guild_id = $1 AND message_id = $2
      `,
      [normalizedGuildId, normalizedMessageId]
    );

    await client.query("COMMIT");
    return (mappingResult.rowCount || 0) > 0 || (panelResult.rowCount || 0) > 0;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
