import { NextRequest, NextResponse } from "next/server";
import { getGuildConfig, updateGuildConfig } from "@/lib/db";
import { parseJsonBody } from "@/lib/http-body";
import { requireGuildContext, requireTotpAuthorization } from "@/lib/request-auth";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ guildId: string }> }
): Promise<NextResponse> {
  const { guildId } = await context.params;
  const auth = await requireGuildContext(request, guildId);
  if (auth instanceof NextResponse) {
    return auth;
  }

  return NextResponse.json({ config: await getGuildConfig(guildId) });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ guildId: string }> }
): Promise<NextResponse> {
  const { guildId } = await context.params;
  const auth = await requireGuildContext(request, guildId);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const totpCheck = await requireTotpAuthorization(guildId, auth.session.userId);
  if (!totpCheck.ok) {
    return NextResponse.json({ error: totpCheck.error }, { status: 403 });
  }

  const parsedBody = await parseJsonBody<Record<string, unknown>>(request);
  if (!parsedBody.ok) {
    return NextResponse.json({ error: parsedBody.error }, { status: 400 });
  }

  const payload = parsedBody.data;
  const updates = (payload.updates && typeof payload.updates === "object" ? payload.updates : payload) as Record<
    string,
    unknown
  >;

  const config = await updateGuildConfig(guildId, {
    log_channel_id: typeof updates.log_channel_id === "string" ? updates.log_channel_id : undefined,
    welcome_channel_id: typeof updates.welcome_channel_id === "string" ? updates.welcome_channel_id : undefined,
    rules_channel_id: typeof updates.rules_channel_id === "string" ? updates.rules_channel_id : undefined,
    chat_channel_id: typeof updates.chat_channel_id === "string" ? updates.chat_channel_id : undefined,
    help_channel_id: typeof updates.help_channel_id === "string" ? updates.help_channel_id : undefined,
    about_channel_id: typeof updates.about_channel_id === "string" ? updates.about_channel_id : undefined,
    perks_channel_id: typeof updates.perks_channel_id === "string" ? updates.perks_channel_id : undefined,
    leveling_channel_id: typeof updates.leveling_channel_id === "string" ? updates.leveling_channel_id : undefined,
    welcome_message_template:
      typeof updates.welcome_message_template === "string" ? updates.welcome_message_template : undefined,
    levelup_message_template:
      typeof updates.levelup_message_template === "string" ? updates.levelup_message_template : undefined,
    kick_message_template:
      typeof updates.kick_message_template === "string" ? updates.kick_message_template : undefined,
    ban_message_template:
      typeof updates.ban_message_template === "string" ? updates.ban_message_template : undefined,
    mute_message_template:
      typeof updates.mute_message_template === "string" ? updates.mute_message_template : undefined,
    level_card_font: typeof updates.level_card_font === "string" ? updates.level_card_font : undefined,
    level_card_primary_color:
      typeof updates.level_card_primary_color === "string" ? updates.level_card_primary_color : undefined,
    level_card_accent_color:
      typeof updates.level_card_accent_color === "string" ? updates.level_card_accent_color : undefined,
    level_card_background_url:
      typeof updates.level_card_background_url === "string" ? updates.level_card_background_url : undefined,
    level_card_overlay_opacity:
      updates.level_card_overlay_opacity == null ? undefined : Number(updates.level_card_overlay_opacity || 0),
    welcome_card_enabled:
      typeof updates.welcome_card_enabled === "boolean"
        ? updates.welcome_card_enabled
        : typeof updates.welcome_card_enabled === "string"
          ? ["1", "true", "yes", "on"].includes(updates.welcome_card_enabled.toLowerCase())
          : undefined,
    welcome_card_title_template:
      typeof updates.welcome_card_title_template === "string" ? updates.welcome_card_title_template : undefined,
    welcome_card_subtitle_template:
      typeof updates.welcome_card_subtitle_template === "string" ? updates.welcome_card_subtitle_template : undefined,
    welcome_card_font: typeof updates.welcome_card_font === "string" ? updates.welcome_card_font : undefined,
    welcome_card_primary_color:
      typeof updates.welcome_card_primary_color === "string" ? updates.welcome_card_primary_color : undefined,
    welcome_card_accent_color:
      typeof updates.welcome_card_accent_color === "string" ? updates.welcome_card_accent_color : undefined,
    welcome_card_background_url:
      typeof updates.welcome_card_background_url === "string" ? updates.welcome_card_background_url : undefined,
    welcome_card_overlay_opacity:
      updates.welcome_card_overlay_opacity == null ? undefined : Number(updates.welcome_card_overlay_opacity || 0),
    ticket_enabled:
      typeof updates.ticket_enabled === "boolean"
        ? updates.ticket_enabled
        : typeof updates.ticket_enabled === "string"
          ? ["1", "true", "yes", "on"].includes(updates.ticket_enabled.toLowerCase())
          : undefined,
    ticket_trigger_channel_id:
      typeof updates.ticket_trigger_channel_id === "string" ? updates.ticket_trigger_channel_id : undefined,
    ticket_trigger_message_id:
      typeof updates.ticket_trigger_message_id === "string" ? updates.ticket_trigger_message_id : undefined,
    ticket_trigger_emoji:
      typeof updates.ticket_trigger_emoji === "string" ? updates.ticket_trigger_emoji : undefined,
    ticket_category_channel_id:
      typeof updates.ticket_category_channel_id === "string" ? updates.ticket_category_channel_id : undefined,
    ticket_support_role_id:
      typeof updates.ticket_support_role_id === "string" ? updates.ticket_support_role_id : undefined,
    ticket_welcome_template:
      typeof updates.ticket_welcome_template === "string" ? updates.ticket_welcome_template : undefined,
    admin_role_name: typeof updates.admin_role_name === "string" ? updates.admin_role_name : undefined,
    mod_role_name: typeof updates.mod_role_name === "string" ? updates.mod_role_name : undefined,
    verification_url: typeof updates.verification_url === "string" ? updates.verification_url : undefined,
    raid_gate_threshold:
      updates.raid_gate_threshold == null ? undefined : Number(updates.raid_gate_threshold || 0),
    raid_monitor_window_seconds:
      updates.raid_monitor_window_seconds == null ? undefined : Number(updates.raid_monitor_window_seconds || 0),
    raid_join_rate_threshold:
      updates.raid_join_rate_threshold == null ? undefined : Number(updates.raid_join_rate_threshold || 0),
    gate_duration_seconds:
      updates.gate_duration_seconds == null ? undefined : Number(updates.gate_duration_seconds || 0),
    join_gate_mode: updates.join_gate_mode === "kick" ? "kick" : updates.join_gate_mode === "timeout" ? "timeout" : undefined
  });

  return NextResponse.json({ config });
}
