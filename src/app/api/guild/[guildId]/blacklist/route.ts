import { NextResponse } from "next/server";

import { assertStaffGuildAccess, getSession } from "@/lib/auth";
import { listBlacklistedWords, addBlacklistedWord, removeBlacklistedWord, replaceBlacklistedWords } from "@/lib/words";
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

  return NextResponse.json({ ok: true, words: listBlacklistedWords() });
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

  try {
    if (action === "add") {
      const word = String(payload.word ?? "");
      const result = addBlacklistedWord(word);
      return NextResponse.json({ ok: true, changed: result.added, words: result.words });
    }

    if (action === "remove") {
      const word = String(payload.word ?? "");
      const result = removeBlacklistedWord(word);
      return NextResponse.json({ ok: true, changed: result.removed, words: result.words });
    }

    if (action === "replace") {
      const words = Array.isArray(payload.words)
        ? payload.words.map((entry) => String(entry ?? ""))
        : [];
      const updated = replaceBlacklistedWords(words);
      return NextResponse.json({ ok: true, changed: true, words: updated });
    }

    return NextResponse.json({ ok: false, error: "action must be add, remove, or replace" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Blacklist update failed"
      },
      { status: 400 }
    );
  }
}
