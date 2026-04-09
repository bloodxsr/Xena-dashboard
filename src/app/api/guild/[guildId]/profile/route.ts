import { NextResponse } from "next/server";

import { assertStaffGuildAccess, getSession } from "@/lib/auth";
import { getGuildProfile, upsertGuildProfile } from "@/lib/db";
import { parseSnowflake } from "@/lib/snowflake";

export const runtime = "nodejs";

type Context = {
  params: {
    guildId: string;
  };
};

export async function GET(_request: Request, context: Context) {
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

  const profile =
    getGuildProfile(guildId) ?? {
      guild_id: guildId,
      display_name: null,
      icon_url: null,
      updated_at: null
    };

  return NextResponse.json({ ok: true, profile });
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

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ ok: false, error: "JSON object expected" }, { status: 400 });
  }

  try {
    const profile = upsertGuildProfile(guildId, body as { display_name?: unknown; icon_url?: unknown });
    return NextResponse.json({ ok: true, profile });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Profile update failed" },
      { status: 400 }
    );
  }
}
