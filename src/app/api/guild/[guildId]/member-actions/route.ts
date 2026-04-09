import { NextResponse } from "next/server";

import { assertStaffGuildAccess, getSession } from "@/lib/auth";
import {
  addFluxerMemberRole,
  banFluxerMember,
  clearFluxerMemberTimeout,
  kickFluxerMember,
  removeFluxerMemberRole,
  setFluxerMemberTimeout,
  unbanFluxerMember
} from "@/lib/fluxer";
import { logModerationAction } from "@/lib/db";
import { parseSnowflake } from "@/lib/snowflake";

export const runtime = "nodejs";

type Context = {
  params: {
    guildId: string;
  };
};

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

export async function POST(request: Request, context: Context) {
  const guildId = parseSnowflake(context.params.guildId);
  if (!guildId) {
    return NextResponse.json({ ok: false, error: "Invalid guild id" }, { status: 400 });
  }

  const session = getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    await assertStaffGuildAccess(guildId, session);
  } catch {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const payload = typeof body === "object" && body ? (body as Record<string, unknown>) : {};
  const action = String(payload.action ?? "").trim().toLowerCase();
  const targetUserId = parseSnowflake(payload.target_user_id);
  const reason = String(payload.reason ?? "Updated from TypeScript dashboard").trim() || "Updated from TypeScript dashboard";

  if (!targetUserId) {
    return NextResponse.json({ ok: false, error: "target_user_id must be a valid Snowflake id" }, { status: 400 });
  }

  try {
    if (action === "kick") {
      await kickFluxerMember(guildId, targetUserId, reason);
      logModerationAction({
        guildId,
        action: "kick",
        actorUserId: session.userId,
        targetUserId,
        reason
      });
      return NextResponse.json({ ok: true, action: "kick", target_user_id: targetUserId });
    }

    if (action === "ban") {
      const banDurationSeconds = clampInt(payload.ban_duration_seconds, 0, 31536000, 0);
      const deleteMessageDays = clampInt(payload.delete_message_days, 0, 7, 0);
      const deleteMessageSeconds = clampInt(payload.delete_message_seconds, 0, 604800, 0);

      await banFluxerMember(guildId, targetUserId, {
        reason,
        banDurationSeconds,
        deleteMessageDays,
        deleteMessageSeconds
      });

      logModerationAction({
        guildId,
        action: "ban",
        actorUserId: session.userId,
        targetUserId,
        reason,
        metadata: {
          ban_duration_seconds: banDurationSeconds,
          delete_message_days: deleteMessageDays,
          delete_message_seconds: deleteMessageSeconds
        }
      });

      return NextResponse.json({ ok: true, action: "ban", target_user_id: targetUserId });
    }

    if (action === "unban") {
      await unbanFluxerMember(guildId, targetUserId, reason);
      logModerationAction({
        guildId,
        action: "unban",
        actorUserId: session.userId,
        targetUserId,
        reason
      });
      return NextResponse.json({ ok: true, action: "unban", target_user_id: targetUserId });
    }

    if (action === "mute") {
      const durationMinutes = clampInt(payload.duration_minutes, 1, 10080, 10);
      const untilIso = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();

      await setFluxerMemberTimeout(guildId, targetUserId, untilIso, reason);
      logModerationAction({
        guildId,
        action: "mute",
        actorUserId: session.userId,
        targetUserId,
        reason,
        metadata: {
          duration_minutes: durationMinutes,
          until: untilIso
        }
      });

      return NextResponse.json({
        ok: true,
        action: "mute",
        target_user_id: targetUserId,
        duration_minutes: durationMinutes,
        until: untilIso
      });
    }

    if (action === "unmute") {
      await clearFluxerMemberTimeout(guildId, targetUserId, reason);
      logModerationAction({
        guildId,
        action: "unmute",
        actorUserId: session.userId,
        targetUserId,
        reason
      });
      return NextResponse.json({ ok: true, action: "unmute", target_user_id: targetUserId });
    }

    if (action === "addrole" || action === "add_role") {
      const roleId = parseSnowflake(payload.role_id);
      if (!roleId) {
        return NextResponse.json({ ok: false, error: "role_id must be a valid Snowflake id" }, { status: 400 });
      }

      await addFluxerMemberRole(guildId, targetUserId, roleId, reason);
      logModerationAction({
        guildId,
        action: "add_role",
        actorUserId: session.userId,
        targetUserId,
        reason: `${reason} | role_id=${roleId}`,
        metadata: { role_id: roleId }
      });
      return NextResponse.json({ ok: true, action: "add_role", target_user_id: targetUserId, role_id: roleId });
    }

    if (action === "removerole" || action === "remove_role") {
      const roleId = parseSnowflake(payload.role_id);
      if (!roleId) {
        return NextResponse.json({ ok: false, error: "role_id must be a valid Snowflake id" }, { status: 400 });
      }

      await removeFluxerMemberRole(guildId, targetUserId, roleId, reason);
      logModerationAction({
        guildId,
        action: "remove_role",
        actorUserId: session.userId,
        targetUserId,
        reason: `${reason} | role_id=${roleId}`,
        metadata: { role_id: roleId }
      });
      return NextResponse.json({ ok: true, action: "remove_role", target_user_id: targetUserId, role_id: roleId });
    }

    return NextResponse.json(
      {
        ok: false,
        error: "action must be kick, ban, unban, mute, unmute, add_role, or remove_role"
      },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Member action failed"
      },
      { status: 502 }
    );
  }
}
