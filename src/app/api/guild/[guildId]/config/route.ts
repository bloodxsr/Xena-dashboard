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
