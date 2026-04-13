export interface FluxerUser {
  id: string;
  username: string;
  globalName: string | null;
  avatarUrl: string | null;
}

export interface FluxerGuild {
  id: string;
  name: string;
  iconUrl: string | null;
  permissions: string;
}

export interface DashboardSession {
  userId: string;
  username: string;
  avatarUrl: string | null;
  accessToken: string;
  expiresAt: string;
}

export interface GuildConfigRecord {
  guild_id: string;
  log_channel_id: string | null;
  welcome_channel_id: string | null;
  rules_channel_id: string | null;
  chat_channel_id: string | null;
  help_channel_id: string | null;
  about_channel_id: string | null;
  perks_channel_id: string | null;
  leveling_channel_id: string | null;
  welcome_message_template: string;
  levelup_message_template: string;
  admin_role_name: string;
  mod_role_name: string;
  verification_url: string | null;
  raid_gate_threshold: number;
  raid_monitor_window_seconds: number;
  raid_join_rate_threshold: number;
  gate_duration_seconds: number;
  join_gate_mode: "timeout" | "kick";
}

export interface RaidGateRecord {
  gate_active: boolean;
  gate_reason: string | null;
  gate_until: string | null;
  updated_at: string | null;
}

export interface WarningRecord {
  user_id: string;
  warning_count: number;
  updated_at: string;
}

export interface CommandToggleRecord {
  command_name: string;
  enabled: boolean;
  updated_at: string;
}

export interface TotpRecord {
  guild_id: string;
  user_id: string;
  secret_base32: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  last_verified_at: string | null;
}
