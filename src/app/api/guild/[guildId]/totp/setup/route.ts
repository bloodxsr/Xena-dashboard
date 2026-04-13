import { NextRequest, NextResponse } from "next/server";
import { getStaffTotpAuth, upsertStaffTotpAuth } from "@/lib/db";
import { parseJsonBody } from "@/lib/http-body";
import { consumeRateLimit, getClientIp } from "@/lib/rate-limit";
import { requireGuildContext } from "@/lib/request-auth";
import { buildTotpAuthUri, formatTotpSecret, generateTotpSecret, resolveTotpAuthorization } from "@/lib/totp";
import { sendBotDirectMessage } from "@/lib/fluxer";

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
  const setupLimit = consumeRateLimit(`totp-setup:${guildId}:${auth.session.userId}:${clientIp}`, {
    windowMs: 10 * 60 * 1000,
    maxHits: 5,
    blockDurationMs: 10 * 60 * 1000
  });

  if (!setupLimit.allowed) {
    return NextResponse.json(
      { error: "Too many setup attempts. Please retry later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(setupLimit.retryAfterSeconds)
        }
      }
    );
  }

  const parsedBody = await parseJsonBody<{ rotate?: boolean }>(request);
  if (!parsedBody.ok) {
    return NextResponse.json({ error: parsedBody.error }, { status: 400 });
  }

  const payload = parsedBody.data;
  const rotate = payload.rotate === true;

  let record = await getStaffTotpAuth(guildId, auth.session.userId);
  if (!record || rotate) {
    record = await upsertStaffTotpAuth({
      guildId,
      userId: auth.session.userId,
      secretBase32: generateTotpSecret(32),
      enabled: true,
      lastVerifiedAt: null
    });
  }

  const accountName = `${auth.session.username}@${guildId}`;
  const otpauthUri = buildTotpAuthUri(record.secret_base32, accountName);
  const formattedSecret = formatTotpSecret(record.secret_base32);

  const dmSent = await sendBotDirectMessage(
    auth.session.userId,
    [
      "Fluxer Dashboard TOTP setup",
      `guild_id: ${guildId}`,
      `secret: ${formattedSecret}`,
      `otpauth_uri: ${otpauthUri}`,
      "Add this to your authenticator app, then verify a code in the dashboard."
    ].join("\n")
  );

  const status = resolveTotpAuthorization(record);

  return NextResponse.json({
    dmSent,
    totp: status,
    setup: dmSent
      ? {
          message: "TOTP setup details were sent in DM."
        }
      : {
          message: "DM failed. Use the fallback setup details below.",
          secret: formattedSecret,
          otpauth_uri: otpauthUri
        }
  });
}
