import { NextRequest, NextResponse } from "next/server";
import {
  countTrackedLevelMembers,
  listReactionRolePanels,
  getCommandStates,
  getGuildConfig,
  getRaidGateState,
  getStaffTotpAuth,
  listTopLevelMembers,
  listWarningCounts
} from "@/lib/db";
import { fetchGuildChannels, fetchGuildRoles } from "@/lib/fluxer";
import { requireGuildContext } from "@/lib/request-auth";
import { resolveTotpAuthorization } from "@/lib/totp";

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

  const [config, raidGate, warnings, commandStates, topMembers, trackedMembers, totpRecord, channels, roles, reactionRolePanels] = await Promise.all([
    getGuildConfig(guildId),
    getRaidGateState(guildId),
    listWarningCounts(guildId, 50),
    getCommandStates(guildId),
    listTopLevelMembers(guildId, 3),
    countTrackedLevelMembers(guildId),
    getStaffTotpAuth(guildId, auth.session.userId),
    fetchGuildChannels(guildId).catch(() => []),
    fetchGuildRoles(guildId).catch(() => []),
    listReactionRolePanels(guildId)
  ]);
  const totp = resolveTotpAuthorization(totpRecord);

  return NextResponse.json({
    guild: auth.guild,
    config,
    raidGate,
    warnings,
    commandStates,
    topMembers,
    trackedMembers,
    channels,
    roles,
    reactionRolePanels,
    totp
  });
}
