import { NextResponse } from "next/server";

import { assertStaffGuildAccess, getSession } from "@/lib/auth";
import {
  bulkDeleteFluxerChannelMessages,
  deleteFluxerChannelMessage,
  fetchFluxerChannelMessages
} from "@/lib/fluxer";
import { logModerationAction } from "@/lib/db";
import { parseSnowflake } from "@/lib/snowflake";

export const runtime = "nodejs";

type Context = {
  params: {
    guildId: string;
  };
};

function clampAmount(raw: unknown): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return 10;
  }
  return Math.max(1, Math.min(Math.trunc(value), 100));
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
  const channelId = parseSnowflake(payload.channel_id);
  const amount = clampAmount(payload.amount);
  const reason = String(payload.reason ?? "Purge requested from TypeScript dashboard").trim() || "Purge requested from TypeScript dashboard";

  if (!channelId) {
    return NextResponse.json({ ok: false, error: "channel_id must be a valid Snowflake id" }, { status: 400 });
  }

  try {
    const messages = await fetchFluxerChannelMessages(channelId, Math.min(amount + 15, 100));
    const toDelete = messages.slice(0, amount);

    if (toDelete.length === 0) {
      return NextResponse.json({ ok: false, error: "No messages available to delete" }, { status: 400 });
    }

    let deletedCount = 0;

    if (toDelete.length >= 2) {
      try {
        await bulkDeleteFluxerChannelMessages(channelId, toDelete);
        deletedCount = toDelete.length;
      } catch {
        deletedCount = 0;
      }
    }

    if (deletedCount < toDelete.length) {
      for (const messageId of toDelete.slice(deletedCount)) {
        try {
          await deleteFluxerChannelMessage(channelId, messageId);
          deletedCount += 1;
        } catch {
          // Continue deleting other candidates when one message fails.
        }
      }
    }

    if (deletedCount === 0) {
      return NextResponse.json({ ok: false, error: "Unable to delete messages in this channel" }, { status: 502 });
    }

    logModerationAction({
      guildId,
      action: "purge",
      actorUserId: session.userId,
      reason,
      channelId,
      metadata: {
        requested: amount,
        deleted: deletedCount
      }
    });

    return NextResponse.json({
      ok: true,
      channel_id: channelId,
      requested: amount,
      deleted: deletedCount,
      partial: deletedCount < toDelete.length
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Purge failed"
      },
      { status: 502 }
    );
  }
}
