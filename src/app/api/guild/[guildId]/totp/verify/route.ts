import { NextRequest, NextResponse } from "next/server";
import { getStaffTotpAuth, markStaffTotpVerified } from "@/lib/db";
import { parseJsonBody } from "@/lib/http-body";
import { consumeRateLimit, getClientIp, resetRateLimit } from "@/lib/rate-limit";
import { requireGuildContext } from "@/lib/request-auth";
import { normalizeTotpCode, resolveTotpAuthorization, verifyTotpCode } from "@/lib/totp";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ guildId: string }> }
): Promise<NextResponse> {
  const { guildId } = await context.params;
  const auth = await requireGuildContext(request, guildId);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const clientIp = getClientIp(request);
  const rateLimitKey = `totp-verify:${guildId}:${auth.session.userId}:${clientIp}`;
  const verifyLimit = consumeRateLimit(rateLimitKey, {
    windowMs: 5 * 60 * 1000,
    maxHits: 6,
    blockDurationMs: 10 * 60 * 1000
  });

  if (!verifyLimit.allowed) {
    return NextResponse.json(
      { error: "Too many verification attempts. Please retry later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(verifyLimit.retryAfterSeconds)
        }
      }
    );
  }

  const parsedBody = await parseJsonBody<{ code?: string }>(request);
  if (!parsedBody.ok) {
    return NextResponse.json({ error: parsedBody.error }, { status: 400 });
  }

  const payload = parsedBody.data;
  const code = normalizeTotpCode(String(payload.code || ""));
  if (!code) {
    return NextResponse.json({ error: "Code is required." }, { status: 400 });
  }

  const record = await getStaffTotpAuth(guildId, auth.session.userId);
  if (!record || !record.enabled || !record.secret_base32) {
    return NextResponse.json({ error: "TOTP is not set up. Run setup first." }, { status: 400 });
  }

  const valid = verifyTotpCode(record.secret_base32, code);
  if (!valid) {
    return NextResponse.json({ error: "Invalid TOTP code." }, { status: 400 });
  }

  resetRateLimit(rateLimitKey);

  const updated = await markStaffTotpVerified(guildId, auth.session.userId);
  const status = resolveTotpAuthorization(updated);
  return NextResponse.json({ ok: true, totp: status });
}
