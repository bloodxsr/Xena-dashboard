import { NextResponse } from "next/server";

import { assertStaffGuildAccess, getSession } from "@/lib/auth";
import { getWarningCount, logModerationAction, resetWarnings, setWarningCount } from "@/lib/db";
import { parseSnowflake } from "@/lib/snowflake";

export const runtime = "nodejs";

type Context = {
  params: {
    guildId: string;
    userId: string;
  };
};

export async function GET(_request: Request, context: Context) {
  const guildId = parseSnowflake(context.params.guildId);
  const userId = parseSnowflake(context.params.userId);

  if (!guildId || !userId) {
    return NextResponse.json({ ok: false, error: "Invalid guild or user id" }, { status: 400 });
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

  const warningCount = getWarningCount(guildId, userId);
  return NextResponse.json({ ok: true, warning_count: warningCount });
}

export async function POST(request: Request, context: Context) {
  const guildId = parseSnowflake(context.params.guildId);
  const userId = parseSnowflake(context.params.userId);

  if (!guildId || !userId) {
    return NextResponse.json({ ok: false, error: "Invalid guild or user id" }, { status: 400 });
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
  const action = String(payload.action ?? "set").trim().toLowerCase();
  const reason = String(payload.reason ?? "Updated from TypeScript dashboard").trim();

  try {
    if (action === "reset") {
      resetWarnings(guildId, userId);
      logModerationAction({
        guildId,
        action: "warnings_reset",
        actorUserId: session.userId,
        targetUserId: userId,
        reason
      });
      return NextResponse.json({ ok: true, warning_count: 0 });
    }

    if (action === "increment") {
      const current = getWarningCount(guildId, userId);
      const warningCount = setWarningCount(guildId, userId, current + 1);
      logModerationAction({
        guildId,
        action: "warning_increment",
        actorUserId: session.userId,
        targetUserId: userId,
        reason,
        metadata: { warning_count: warningCount }
      });
      return NextResponse.json({ ok: true, warning_count: warningCount });
    }

    if (action === "set") {
      const nextCount = Number(payload.warning_count ?? 0);
      const warningCount = setWarningCount(guildId, userId, nextCount);
      logModerationAction({
        guildId,
        action: "warnings_set",
        actorUserId: session.userId,
        targetUserId: userId,
        reason,
        metadata: { warning_count: warningCount }
      });
      return NextResponse.json({ ok: true, warning_count: warningCount });
    }

    return NextResponse.json({ ok: false, error: "action must be set, increment, or reset" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Warning update failed"
      },
      { status: 400 }
    );
  }
}
