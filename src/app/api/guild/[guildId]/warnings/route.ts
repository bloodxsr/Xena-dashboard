import { NextResponse } from "next/server";

import { assertStaffGuildAccess, getSession } from "@/lib/auth";
import { listWarnings } from "@/lib/db";
import { parseSnowflake } from "@/lib/snowflake";

export const runtime = "nodejs";

type Context = {
  params: {
    guildId: string;
  };
};

export async function GET(request: Request, context: Context) {
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

  const url = new URL(request.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? 50);
  const limit = Number.isFinite(limitRaw) ? limitRaw : 50;

  const items = listWarnings(guildId, limit);
  return NextResponse.json({ ok: true, items });
}
