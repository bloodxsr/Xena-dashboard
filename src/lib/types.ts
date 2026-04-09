export type SessionPayload = {
  userId: number;
  username: string;
  accessToken: string;
  issuedAt: number;
  expiresAt: number;
};

export type FluxerUser = {
  id: string;
  username?: string | null;
  global_name?: string | null;
  display_name?: string | null;
  avatar?: string | null;
  email?: string | null;
};

export type FluxerGuildOAuth = {
  id: string;
  name?: string | null;
  icon?: string | null;
  permissions?: string | null;
  permissions_new?: string | null;
};

export type DiscordUser = {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
};

export type DiscordGuildOAuth = {
  id: string;
  name: string;
  icon?: string | null;
  permissions?: string;
  permissions_new?: string;
};

export type StaffGuild = {
  id: string;
  name: string;
  iconUrl: string | null;
  permissions: string;
};

export type GuildConfig = {
  guild_id: number;
  log_channel_id: number | null;
  welcome_channel_id: number | null;
  rules_channel_id: number | null;
  chat_channel_id: number | null;
  help_channel_id: number | null;
  about_channel_id: number | null;
  perks_channel_id: number | null;
  admin_role_name: string;
  mod_role_name: string;
  sync_mode: "global" | "guild";
  sync_guild_id: number | null;
  verification_url: string | null;
  raid_detection_enabled: boolean;
  raid_gate_threshold: number;
  raid_monitor_window_seconds: number;
  raid_join_rate_threshold: number;
  gate_duration_seconds: number;
  join_gate_mode: "timeout" | "kick";
};

export type RaidGateState = {
  gate_active: boolean;
  gate_reason: string | null;
  gate_until: string | null;
  updated_at: string | null;
};

export type VerificationStatus = {
  status: string;
  risk_score: number;
  verification_url: string | null;
  reason: string;
  created_at: string;
  updated_at: string;
  verified_by_user_id: number | null;
};

export type PendingVerification = VerificationStatus & {
  user_id: number;
};

export type JoinEvent = {
  user_id: number;
  risk_score: number;
  risk_level: string;
  action: string;
  created_at: string;
};

export type ModerationLog = {
  id: number;
  actor_user_id: number | null;
  target_user_id: number | null;
  action: string;
  reason: string | null;
  channel_id: number | null;
  message_id: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type WarningEntry = {
  user_id: number;
  warning_count: number;
  updated_at: string;
};

export type GuildRole = {
  id: string;
  name: string;
  position: number;
};

export type GuildProfile = {
  guild_id: string;
  display_name: string | null;
  icon_url: string | null;
  updated_at: string | null;
};
