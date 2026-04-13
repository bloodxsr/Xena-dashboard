import { NextRequest, NextResponse } from "next/server";
import { assertFluxerOAuthConfigured } from "@/lib/env";
import { buildFluxerAuthorizeUrl } from "@/lib/fluxer";
import { createSignedOAuthState } from "@/lib/oauth-state";
import { consumeRateLimit, getClientIp } from "@/lib/rate-limit";

const OAUTH_STATE_COOKIE = "fluxer_dashboard_oauth_state";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const clientIp = getClientIp(request);
  const loginLimit = consumeRateLimit(`auth-login:${clientIp}`, {
    windowMs: 10 * 60 * 1000,
    maxHits: 20,
    blockDurationMs: 10 * 60 * 1000
  });

  if (!loginLimit.allowed) {
    return NextResponse.json(
      {
        error: "Too many login attempts. Please retry later."
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(loginLimit.retryAfterSeconds)
        }
      }
    );
  }

  try {
    assertFluxerOAuthConfigured();

    const state = createSignedOAuthState(600);
    const redirectUrl = buildFluxerAuthorizeUrl(state);

    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set({
      name: OAUTH_STATE_COOKIE,
      value: state,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600
    });

    return response;
  } catch (error) {
    console.error("auth login route failed", error);
    return NextResponse.json(
      {
        error: "Authentication service unavailable."
      },
      { status: 500 }
    );
  }
}
