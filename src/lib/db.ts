import Database from "better-sqlite3";

import { getEnv } from "@/lib/env";
import type {
  GuildConfig,
  GuildProfile,
  JoinEvent,
  ModerationLog,
  PendingVerification,
  RaidGateState,
  VerificationStatus,
  WarningEntry
} from "@/lib/types";

type DbHandle = Database.Database;

let db: DbHandle | null = null;
let localSchemaEnsured = false;

const CONFIG_KEYS = new Set([
  "log_channel_id",
  "welcome_channel_id",
  "rules_channel_id",
  "chat_channel_id",
  "help_channel_id",
  "about_channel_id",
  "perks_channel_id",
  "admin_role_name",
  "mod_role_name",
  "sync_mode",
  "sync_guild_id",
  "verification_url",
  "raid_detection_enabled",
  "raid_gate_threshold",
  "raid_monitor_window_seconds",
  "raid_join_rate_threshold",
  "gate_duration_seconds",
  "join_gate_mode"
]);

const CHANNEL_ID_KEYS = new Set([
  "log_channel_id",
  "welcome_channel_id",
  "rules_channel_id",
  "chat_channel_id",
  "help_channel_id",
  "about_channel_id",
  "perks_channel_id"
]);

function nowIso(): string {
  return new Date().toISOString();
}

function ensureLocalSchema(database: DbHandle): void {
  if (localSchemaEnsured) {
    return;
  }

  database.exec(
    `
      CREATE TABLE IF NOT EXISTS guild_profiles (
        guild_id INTEGER PRIMARY KEY,
        display_name TEXT,
        icon_url TEXT,
        updated_at TEXT NOT NULL
      );
    `
  );

  localSchemaEnsured = true;
}

function getDb(): DbHandle {
  if (db) {
    return db;
  }

  db = new Database(getEnv().databasePath);
  db.pragma("journal_mode = WAL");
  ensureLocalSchema(db);
  return db;
}

function tableExists(database: DbHandle, tableName: string): boolean {
  const row = database
    .prepare("SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1")
    .get(tableName) as Record<string, unknown> | undefined;

  return Number(row?.present ?? 0) === 1;
}

function tableHasColumn(database: DbHandle, tableName: string, columnName: string): boolean {
  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all() as Array<Record<string, unknown>>;
  return columns.some((column) => String(column.name ?? "") === columnName);
}

function ensureGuildConfig(guildId: number | string): void {
  const database = getDb();
  database.prepare("INSERT OR IGNORE INTO guild_config (guild_id) VALUES (?)").run(guildId);
}

function mapGuildConfig(row: Record<string, unknown>): GuildConfig {
  return {
    guild_id: Number(row.guild_id),
    log_channel_id: row.log_channel_id == null ? null : Number(row.log_channel_id),
    welcome_channel_id: row.welcome_channel_id == null ? null : Number(row.welcome_channel_id),
    rules_channel_id: row.rules_channel_id == null ? null : Number(row.rules_channel_id),
    chat_channel_id: row.chat_channel_id == null ? null : Number(row.chat_channel_id),
    help_channel_id: row.help_channel_id == null ? null : Number(row.help_channel_id),
    about_channel_id: row.about_channel_id == null ? null : Number(row.about_channel_id),
    perks_channel_id: row.perks_channel_id == null ? null : Number(row.perks_channel_id),
    admin_role_name: String(row.admin_role_name ?? "Admin"),
    mod_role_name: String(row.mod_role_name ?? "Moderator"),
    sync_mode: String(row.sync_mode ?? "global") === "guild" ? "guild" : "global",
    sync_guild_id: row.sync_guild_id == null ? null : Number(row.sync_guild_id),
    verification_url: (row.verification_url as string | null) ?? null,
    raid_detection_enabled: Boolean(row.raid_detection_enabled),
    raid_gate_threshold: Number(row.raid_gate_threshold ?? 0.72),
    raid_monitor_window_seconds: Number(row.raid_monitor_window_seconds ?? 90),
    raid_join_rate_threshold: Number(row.raid_join_rate_threshold ?? 8),
    gate_duration_seconds: Number(row.gate_duration_seconds ?? 900),
    join_gate_mode: String(row.join_gate_mode ?? "timeout") === "kick" ? "kick" : "timeout"
  };
}

export function getGuildConfig(guildId: number | string): GuildConfig {
  ensureGuildConfig(guildId);

  const database = getDb();
  const row = database.prepare("SELECT * FROM guild_config WHERE guild_id = ?").get(guildId) as
    | Record<string, unknown>
    | undefined;

  if (!row) {
    throw new Error("Guild config row not found after initialization");
  }

  return mapGuildConfig(row);
}

export function updateGuildConfig(guildId: number | string, updates: Record<string, unknown>): GuildConfig {
  const cleanEntries = Object.entries(updates).filter(([key]) => CONFIG_KEYS.has(key));
  if (!cleanEntries.length) {
    return getGuildConfig(guildId);
  }

  const normalized: Record<string, unknown> = {};
  for (const [key, value] of cleanEntries) {
    normalized[key] = value;
  }

  for (const key of Object.keys(normalized)) {
    if (!CHANNEL_ID_KEYS.has(key)) {
      continue;
    }

    const rawText = String(normalized[key] ?? "").trim().toLowerCase();
    if (!rawText || rawText === "0" || ["null", "none", "off", "clear"].includes(rawText)) {
      normalized[key] = null;
      continue;
    }

    const parsed = Number(normalized[key]);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new Error(`${key} must be a positive integer channel id or empty`);
    }
    normalized[key] = parsed;
  }

  if ("admin_role_name" in normalized) {
    const role = String(normalized.admin_role_name ?? "").trim();
    if (!role) {
      throw new Error("admin_role_name cannot be empty");
    }
    normalized.admin_role_name = role;
  }

  if ("mod_role_name" in normalized) {
    const role = String(normalized.mod_role_name ?? "").trim();
    if (!role) {
      throw new Error("mod_role_name cannot be empty");
    }
    normalized.mod_role_name = role;
  }

  if ("sync_mode" in normalized) {
    const mode = String(normalized.sync_mode ?? "").trim().toLowerCase();
    if (mode !== "global" && mode !== "guild") {
      throw new Error("sync_mode must be global or guild");
    }
    normalized.sync_mode = mode;
    if (mode === "global" && !("sync_guild_id" in normalized)) {
      normalized.sync_guild_id = null;
    }
  }

  if ("sync_guild_id" in normalized) {
    const rawText = String(normalized.sync_guild_id ?? "").trim().toLowerCase();
    if (!rawText || rawText === "0" || ["null", "none", "off", "clear"].includes(rawText)) {
      normalized.sync_guild_id = null;
    } else {
      const parsed = Number(normalized.sync_guild_id);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error("sync_guild_id must be a positive integer or empty");
      }
      normalized.sync_guild_id = parsed;
    }
  }

  if ("verification_url" in normalized) {
    const raw = String(normalized.verification_url ?? "").trim();
    if (!raw || ["off", "none", "null", "disable", "disabled"].includes(raw.toLowerCase())) {
      normalized.verification_url = null;
    } else if (!raw.startsWith("http://") && !raw.startsWith("https://")) {
      throw new Error("verification_url must start with http:// or https://");
    } else {
      normalized.verification_url = raw;
    }
  }

  if ("join_gate_mode" in normalized) {
    const mode = String(normalized.join_gate_mode ?? "").trim().toLowerCase();
    if (mode !== "timeout" && mode !== "kick") {
      throw new Error("join_gate_mode must be timeout or kick");
    }
    normalized.join_gate_mode = mode;
  }

  if ("raid_detection_enabled" in normalized) {
    const raw = String(normalized.raid_detection_enabled ?? "false").toLowerCase();
    normalized.raid_detection_enabled = ["1", "true", "yes", "on", "enabled"].includes(raw) ? 1 : 0;
  }

  if ("raid_gate_threshold" in normalized) {
    const value = Number(normalized.raid_gate_threshold);
    if (!Number.isFinite(value) || value <= 0 || value > 1) {
      throw new Error("raid_gate_threshold must be between 0 and 1");
    }
    normalized.raid_gate_threshold = value;
  }

  if ("raid_monitor_window_seconds" in normalized) {
    const value = Number(normalized.raid_monitor_window_seconds);
    if (!Number.isInteger(value) || value < 15 || value > 600) {
      throw new Error("raid_monitor_window_seconds must be between 15 and 600");
    }
    normalized.raid_monitor_window_seconds = value;
  }

  if ("raid_join_rate_threshold" in normalized) {
    const value = Number(normalized.raid_join_rate_threshold);
    if (!Number.isInteger(value) || value < 2 || value > 100) {
      throw new Error("raid_join_rate_threshold must be between 2 and 100");
    }
    normalized.raid_join_rate_threshold = value;
  }

  if ("gate_duration_seconds" in normalized) {
    const value = Number(normalized.gate_duration_seconds);
    if (!Number.isInteger(value) || value < 60 || value > 86400) {
      throw new Error("gate_duration_seconds must be between 60 and 86400");
    }
    normalized.gate_duration_seconds = value;
  }

  ensureGuildConfig(guildId);
  const columns = Object.keys(normalized);
  const values = columns.map((column) => normalized[column]);
  const assignmentSql = columns.map((column) => `${column} = ?`).join(", ");

  const database = getDb();
  database.prepare(`UPDATE guild_config SET ${assignmentSql} WHERE guild_id = ?`).run(...values, guildId);
  return getGuildConfig(guildId);
}

export function getGuildProfile(guildId: number | string): GuildProfile | null {
  const database = getDb();
  const row = database
    .prepare("SELECT CAST(guild_id AS TEXT) AS guild_id, display_name, icon_url, updated_at FROM guild_profiles WHERE guild_id = ?")
    .get(guildId) as Record<string, unknown> | undefined;

  if (!row) {
    return null;
  }

  return {
    guild_id: String(row.guild_id ?? guildId),
    display_name: row.display_name == null ? null : String(row.display_name),
    icon_url: row.icon_url == null ? null : String(row.icon_url),
    updated_at: row.updated_at == null ? null : String(row.updated_at)
  };
}

export function upsertGuildProfile(
  guildId: number | string,
  updates: { display_name?: unknown; icon_url?: unknown }
): GuildProfile {
  const normalized: Record<string, string | null> = {};

  if (Object.prototype.hasOwnProperty.call(updates, "display_name")) {
    const displayName = String(updates.display_name ?? "").trim();
    normalized.display_name = displayName || null;
  }

  if (Object.prototype.hasOwnProperty.call(updates, "icon_url")) {
    const raw = String(updates.icon_url ?? "").trim();
    if (!raw || ["off", "none", "null", "disable", "disabled", "clear"].includes(raw.toLowerCase())) {
      normalized.icon_url = null;
    } else if (!raw.startsWith("http://") && !raw.startsWith("https://")) {
      throw new Error("icon_url must start with http:// or https://");
    } else {
      normalized.icon_url = raw;
    }
  }

  const columns = Object.keys(normalized);
  if (columns.length === 0) {
    return (
      getGuildProfile(guildId) ?? {
        guild_id: String(guildId),
        display_name: null,
        icon_url: null,
        updated_at: null
      }
    );
  }

  const values = columns.map((column) => normalized[column]);
  const insertColumns = columns.join(", ");
  const insertPlaceholders = columns.map(() => "?").join(", ");
  const updateAssignments = columns.map((column) => `${column} = excluded.${column}`).join(", ");

  const database = getDb();
  database
    .prepare(
      `
        INSERT INTO guild_profiles (guild_id, ${insertColumns}, updated_at)
        VALUES (?, ${insertPlaceholders}, ?)
        ON CONFLICT(guild_id)
        DO UPDATE SET
          ${updateAssignments},
          updated_at = excluded.updated_at
      `
    )
    .run(guildId, ...values, nowIso());

  const profile = getGuildProfile(guildId);
  if (!profile) {
    throw new Error("Failed to upsert guild profile");
  }
  return profile;
}

export function getRaidGateState(guildId: number | string): RaidGateState {
  const database = getDb();
  const row = database
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
    gate_active: Boolean(row.gate_active),
    gate_reason: (row.gate_reason as string | null) ?? null,
    gate_until: (row.gate_until as string | null) ?? null,
    updated_at: (row.updated_at as string | null) ?? null
  };
}

export function setRaidGateState(
  guildId: number | string,
  gateActive: boolean,
  reason: string | null,
  gateUntil: string | null
): RaidGateState {
  const database = getDb();

  database
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

export function setRaidGateForDuration(guildId: number | string, durationSeconds: number, reason: string): RaidGateState {
  const clampedDuration = Math.max(60, Math.min(durationSeconds, 86400));
  const gateUntil = new Date(Date.now() + clampedDuration * 1000).toISOString();
  return setRaidGateState(guildId, true, reason, gateUntil);
}

export function getVerificationStatus(guildId: number | string, userId: number | string): VerificationStatus | null {
  const database = getDb();
  const row = database
    .prepare(
      `
        SELECT status, risk_score, verification_url, reason, created_at, updated_at, verified_by_user_id
        FROM verification_queue
        WHERE guild_id = ? AND user_id = ?
      `
    )
    .get(guildId, userId) as Record<string, unknown> | undefined;

  if (!row) {
    return null;
  }

  return {
    status: String(row.status ?? "pending"),
    risk_score: Number(row.risk_score ?? 0),
    verification_url: (row.verification_url as string | null) ?? null,
    reason: String(row.reason ?? ""),
    created_at: String(row.created_at ?? nowIso()),
    updated_at: String(row.updated_at ?? nowIso()),
    verified_by_user_id: row.verified_by_user_id == null ? null : Number(row.verified_by_user_id)
  };
}

export function upsertVerificationStatus(args: {
  guildId: number | string;
  userId: number | string;
  status: string;
  riskScore: number;
  verificationUrl: string | null;
  reason: string;
  verifiedByUserId?: number | null;
}): VerificationStatus {
  const database = getDb();
  const now = nowIso();

  database
    .prepare(
      `
        INSERT INTO verification_queue (
          guild_id, user_id, status, risk_score, verification_url, reason,
          created_at, updated_at, verified_by_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(guild_id, user_id)
        DO UPDATE SET
          status = excluded.status,
          risk_score = excluded.risk_score,
          verification_url = excluded.verification_url,
          reason = excluded.reason,
          updated_at = excluded.updated_at,
          verified_by_user_id = excluded.verified_by_user_id
      `
    )
    .run(
      args.guildId,
      args.userId,
      args.status,
      args.riskScore,
      args.verificationUrl,
      args.reason,
      now,
      now,
      args.verifiedByUserId ?? null
    );

  const status = getVerificationStatus(args.guildId, args.userId);
  if (!status) {
    throw new Error("Unable to read updated verification row");
  }
  return status;
}

export function listPendingVerifications(guildId: number | string, limit = 20): PendingVerification[] {
  const clamped = Math.max(1, Math.min(limit, 50));
  const database = getDb();
  const rows = database
    .prepare(
      `
        SELECT user_id, status, risk_score, verification_url, reason, created_at, updated_at, verified_by_user_id
        FROM verification_queue
        WHERE guild_id = ? AND status = 'pending'
        ORDER BY updated_at DESC
        LIMIT ?
      `
    )
    .all(guildId, clamped) as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    user_id: Number(row.user_id),
    status: String(row.status),
    risk_score: Number(row.risk_score ?? 0),
    verification_url: (row.verification_url as string | null) ?? null,
    reason: String(row.reason ?? ""),
    created_at: String(row.created_at ?? nowIso()),
    updated_at: String(row.updated_at ?? nowIso()),
    verified_by_user_id: row.verified_by_user_id == null ? null : Number(row.verified_by_user_id)
  }));
}

export function listRecentJoinEvents(guildId: number | string, limit = 20): JoinEvent[] {
  const clamped = Math.max(1, Math.min(limit, 100));
  const database = getDb();
  const rows = database
    .prepare(
      `
        SELECT user_id, risk_score, risk_level, action, created_at
        FROM join_events
        WHERE guild_id = ?
        ORDER BY id DESC
        LIMIT ?
      `
    )
    .all(guildId, clamped) as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    user_id: Number(row.user_id),
    risk_score: Number(row.risk_score ?? 0),
    risk_level: String(row.risk_level ?? "unknown"),
    action: String(row.action ?? "allow"),
    created_at: String(row.created_at ?? nowIso())
  }));
}

function parseMetadata(raw: unknown): Record<string, unknown> | null {
  if (raw == null) {
    return null;
  }

  const text = String(raw).trim();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { raw: text };
  }
}

export function listModerationLogs(guildId: number | string, limit = 20): ModerationLog[] {
  const clamped = Math.max(1, Math.min(limit, 100));
  const database = getDb();

  if (!tableExists(database, "moderation_logs")) {
    return [];
  }

  const rows = database
    .prepare(
      `
        SELECT id, actor_user_id, target_user_id, action, reason, channel_id, message_id, metadata, created_at
        FROM moderation_logs
        WHERE guild_id = ?
        ORDER BY id DESC
        LIMIT ?
      `
    )
    .all(guildId, clamped) as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    id: Number(row.id ?? 0),
    actor_user_id: row.actor_user_id == null ? null : Number(row.actor_user_id),
    target_user_id: row.target_user_id == null ? null : Number(row.target_user_id),
    action: String(row.action ?? ""),
    reason: row.reason == null ? null : String(row.reason),
    channel_id: row.channel_id == null ? null : Number(row.channel_id),
    message_id: row.message_id == null ? null : Number(row.message_id),
    metadata: parseMetadata(row.metadata),
    created_at: String(row.created_at ?? nowIso())
  }));
}

export function logModerationAction(args: {
  guildId: number | string;
  action: string;
  actorUserId: number | null;
  targetUserId?: number | string | null;
  reason?: string | null;
  channelId?: number | string | null;
  messageId?: number | string | null;
  metadata?: Record<string, unknown> | null;
}): void {
  const database = getDb();

  if (!tableExists(database, "moderation_logs")) {
    return;
  }

  database
    .prepare(
      `
        INSERT INTO moderation_logs (
          guild_id, actor_user_id, target_user_id, action, reason,
          channel_id, message_id, metadata, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    .run(
      args.guildId,
      args.actorUserId,
      args.targetUserId ?? null,
      args.action,
      args.reason ?? null,
      args.channelId ?? null,
      args.messageId ?? null,
      args.metadata ? JSON.stringify(args.metadata) : null,
      nowIso()
    );
}

export function listWarnings(guildId: number | string, limit = 50): WarningEntry[] {
  const clamped = Math.max(1, Math.min(limit, 200));
  const database = getDb();

  if (!tableExists(database, "warnings")) {
    return [];
  }

  const rows = database
    .prepare(
      `
        SELECT user_id, warning_count, updated_at
        FROM warnings
        WHERE guild_id = ?
        ORDER BY warning_count DESC, updated_at DESC
        LIMIT ?
      `
    )
    .all(guildId, clamped) as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    user_id: Number(row.user_id ?? 0),
    warning_count: Number(row.warning_count ?? 0),
    updated_at: String(row.updated_at ?? nowIso())
  }));
}

export function getWarningCount(guildId: number | string, userId: number | string): number {
  const database = getDb();

  if (!tableExists(database, "warnings")) {
    return 0;
  }

  const row = database
    .prepare("SELECT warning_count FROM warnings WHERE guild_id = ? AND user_id = ?")
    .get(guildId, userId) as Record<string, unknown> | undefined;

  return Number(row?.warning_count ?? 0);
}

export function setWarningCount(guildId: number | string, userId: number | string, warningCount: number): number {
  if (!Number.isInteger(warningCount) || warningCount < 0) {
    throw new Error("warning_count must be a non-negative integer");
  }

  const database = getDb();

  if (!tableExists(database, "warnings")) {
    throw new Error("warnings table not found in database");
  }

  if (warningCount === 0) {
    database.prepare("DELETE FROM warnings WHERE guild_id = ? AND user_id = ?").run(guildId, userId);
    return 0;
  }

  database
    .prepare(
      `
        INSERT INTO warnings (guild_id, user_id, warning_count, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(guild_id, user_id)
        DO UPDATE SET warning_count = excluded.warning_count, updated_at = excluded.updated_at
      `
    )
    .run(guildId, userId, warningCount, nowIso());

  return warningCount;
}

export function resetWarnings(guildId: number | string, userId: number | string): void {
  const database = getDb();

  if (!tableExists(database, "warnings")) {
    return;
  }

  database.prepare("DELETE FROM warnings WHERE guild_id = ? AND user_id = ?").run(guildId, userId);
}

export function listKnownGuildIds(): number[] {
  const database = getDb();
  const sourceTables = ["guild_config", "raid_state", "verification_queue", "join_events", "warnings", "guild_profiles"];

  const usableTables = sourceTables.filter((tableName) => {
    if (!tableExists(database, tableName)) {
      return false;
    }

    return tableHasColumn(database, tableName, "guild_id");
  });

  if (usableTables.length === 0) {
    return [];
  }

  const unionSql = usableTables
    .map((tableName) => `SELECT DISTINCT guild_id AS id FROM ${tableName}`)
    .join(" UNION ");

  const rows = database.prepare(unionSql).all() as Array<Record<string, unknown>>;

  return rows
    .map((row) => Number(row.id))
    .filter((value) => Number.isInteger(value) && value > 0)
    .sort((a, b) => a - b);
}
