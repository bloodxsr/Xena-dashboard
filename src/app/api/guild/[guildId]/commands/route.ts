import { NextRequest, NextResponse } from "next/server";
import { getCommandStates, setCommandEnabled } from "@/lib/db";
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

  return NextResponse.json({ commandStates: await getCommandStates(guildId) });
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

  const parsedBody = await parseJsonBody<{ commandName?: string; enabled?: boolean }>(request);
  if (!parsedBody.ok) {
    return NextResponse.json({ error: parsedBody.error }, { status: 400 });
  }

  const payload = parsedBody.data;
  if (!payload.commandName || typeof payload.enabled !== "boolean") {
    return NextResponse.json({ error: "commandName and enabled are required." }, { status: 400 });
  }

  const updated = await setCommandEnabled(guildId, payload.commandName, payload.enabled);
  return NextResponse.json({ updated, commandStates: await getCommandStates(guildId) });
}
