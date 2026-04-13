import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { exchangeOAuthCodeForToken, fetchCurrentUser } from "@/lib/fluxer";
import { verifySignedOAuthState } from "@/lib/oauth-state";
import { writeSessionCookie } from "@/lib/session";

const OAUTH_STATE_COOKIE = "fluxer_dashboard_oauth_state";

export async function handleOAuthCallback(request: NextRequest): Promise<NextResponse> {
  const stateFromCookie = request.cookies.get(OAUTH_STATE_COOKIE)?.value || "";
  const stateFromQuery = String(request.nextUrl.searchParams.get("state") || "");
  const code = String(request.nextUrl.searchParams.get("code") || "");

  if (!code) {
    return NextResponse.redirect(new URL("/?error=missing_oauth_code", request.url));
  }

  const cookieStateMatches = Boolean(stateFromCookie && stateFromQuery && stateFromCookie === stateFromQuery);
  const signedStateMatches = stateFromQuery ? verifySignedOAuthState(stateFromQuery) : false;
  if (!stateFromQuery || (!cookieStateMatches && !signedStateMatches)) {
    return NextResponse.redirect(new URL("/?error=invalid_oauth_state", request.url));
  }

  try {
    const token = await exchangeOAuthCodeForToken(code);
    const user = await fetchCurrentUser(token.accessToken);

    const expiresAt = new Date(Date.now() + Math.max(60, Math.min(token.expiresIn, env.dashboardSessionTtlSeconds)) * 1000);

    const response = NextResponse.redirect(new URL("/dashboard", request.url));
    response.cookies.set({
      name: OAUTH_STATE_COOKIE,
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0
    });

    writeSessionCookie(response, {
      userId: user.id,
      username: user.globalName || user.username,
      avatarUrl: user.avatarUrl,
      accessToken: token.accessToken,
      expiresAt: expiresAt.toISOString()
    });

    return response;
  } catch (error) {
    console.error("oauth callback failed", error);
    return NextResponse.redirect(new URL("/?error=oauth_failed", request.url));
  }
}