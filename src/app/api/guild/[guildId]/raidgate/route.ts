import { NextResponse } from "next/server";

import { assertStaffGuildAccess, getSession } from "@/lib/auth";
import { setRaidGateForDuration, setRaidGateState } from "@/lib/db";
import { parseSnowflake } from "@/lib/snowflake";

export const runtime = "nodejs";

type Context = {
  params: {
    guildId: string;
  };
};

function toBool(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  const text = String(value ?? "").trim().toLowerCase();
  return ["1", "true", "yes", "on", "enabled"].includes(text);
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
  const active = toBool(payload.active);

  if (!active) {
    const state = setRaidGateState(guildId, false, "Disabled from TypeScript dashboard", null);
    return NextResponse.json({ ok: true, state });
  }

  const durationRaw = Number(payload.duration_seconds ?? 900);
  const duration = Number.isFinite(durationRaw) ? durationRaw : 900;
  const reason = String(payload.reason ?? "Enabled from TypeScript dashboard").trim() || "Enabled from TypeScript dashboard";

  const state = setRaidGateForDuration(guildId, duration, reason);
  return NextResponse.json({ ok: true, state });
}
