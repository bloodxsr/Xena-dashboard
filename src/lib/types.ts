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

export interface FluxerGuildChannel {
  id: string;
  guildId: string;
  name: string;
  type: number;
  position: number;
  parentId: string | null;
}

export interface FluxerGuildRole {
  id: string;
  guildId: string;
  name: string;
  color: number;
  position: number;
  managed: boolean;
  mentionable: boolean;
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
  kick_message_template: string;
  ban_message_template: string;
  mute_message_template: string;
  level_card_font: string;
  level_card_primary_color: string;
  level_card_accent_color: string;
  level_card_background_url: string | null;
  level_card_overlay_opacity: number;
  welcome_card_enabled: boolean;
  welcome_card_title_template: string;
  welcome_card_subtitle_template: string;
  welcome_card_font: string;
  welcome_card_primary_color: string;
  welcome_card_accent_color: string;
  welcome_card_background_url: string | null;
  welcome_card_overlay_opacity: number;
  ticket_enabled: boolean;
  ticket_trigger_channel_id: string | null;
  ticket_trigger_message_id: string | null;
  ticket_trigger_emoji: string;
  ticket_category_channel_id: string | null;
  ticket_support_role_id: string | null;
  ticket_welcome_template: string;
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

export interface ReactionRoleMappingRecord {
  guild_id: string;
  channel_id: string;
  message_id: string;
  emoji_key: string;
  emoji_display: string;
  role_id: string;
  created_at: string;
}

export interface ReactionRolePanelRecord {
  guild_id: string;
  channel_id: string;
  message_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  mappings: ReactionRoleMappingRecord[];
}
