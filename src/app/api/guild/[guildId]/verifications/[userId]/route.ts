import { NextResponse } from "next/server";

import { assertStaffGuildAccess, getSession } from "@/lib/auth";
import { getVerificationStatus, logModerationAction, upsertVerificationStatus } from "@/lib/db";
import { clearFluxerMemberTimeout, kickFluxerMember } from "@/lib/fluxer";
import { parseSnowflake } from "@/lib/snowflake";

export const runtime = "nodejs";

type Context = {
  params: {
    guildId: string;
    userId: string;
  };
};

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
  const action = String(payload.action ?? "").trim().toLowerCase();
  const reason = String(payload.reason ?? "").trim();

  const current = getVerificationStatus(guildId, userId);
  const riskScore = current?.risk_score ?? 0;
  const verificationUrl = current?.verification_url ?? null;

  if (action === "approve") {
    const updated = upsertVerificationStatus({
      guildId,
      userId,
      status: "verified",
      riskScore,
      verificationUrl,
      reason: reason || "Approved from TypeScript dashboard",
      verifiedByUserId: session.userId
    });

    let timeoutCleared = false;
    try {
      await clearFluxerMemberTimeout(guildId, userId, "Verification approved from TypeScript dashboard");
      timeoutCleared = true;
    } catch {
      timeoutCleared = false;
    }

    logModerationAction({
      guildId,
      action: "verification_approved",
      actorUserId: session.userId,
      targetUserId: userId,
      reason: reason || "Join verification approved",
      metadata: {
        timeout_cleared: timeoutCleared
      }
    });

    return NextResponse.json({
      ok: true,
      updated,
      timeout_cleared: timeoutCleared
    });
  }

  if (action === "reject") {
    const updated = upsertVerificationStatus({
      guildId,
      userId,
      status: "rejected",
      riskScore,
      verificationUrl,
      reason: reason || "Rejected from TypeScript dashboard",
      verifiedByUserId: session.userId
    });

    let kickApplied = false;
    try {
      await kickFluxerMember(guildId, userId, reason || "Join verification rejected");
      kickApplied = true;
    } catch {
      kickApplied = false;
    }

    logModerationAction({
      guildId,
      action: "verification_rejected",
      actorUserId: session.userId,
      targetUserId: userId,
      reason: reason || "Join verification rejected",
      metadata: {
        kick_applied: kickApplied
      }
    });

    return NextResponse.json({ ok: true, updated, kick_applied: kickApplied });
  }

  return NextResponse.json({ ok: false, error: "action must be approve or reject" }, { status: 400 });
}
