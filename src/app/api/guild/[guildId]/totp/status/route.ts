import { NextRequest, NextResponse } from "next/server";
import { getStaffTotpAuth } from "@/lib/db";
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

  const status = resolveTotpAuthorization(await getStaffTotpAuth(guildId, auth.session.userId));
  return NextResponse.json({ totp: status });
}
