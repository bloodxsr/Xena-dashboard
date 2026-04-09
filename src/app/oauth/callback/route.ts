import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { exchangeFluxerCode, fetchFluxerUser } from "@/lib/fluxer";
import { sanitizeNextPath } from "@/lib/next-path";
import { parseOauthState } from "@/lib/oauth-state";
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/session";

function redirectToPath(path: string, status = 303): NextResponse {
  const response = new NextResponse(null, { status });
  response.headers.set("Location", path);
  return response;
}

function clearOauthCookies(response: NextResponse): void {
  response.cookies.set("fx_oauth_state", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
  response.cookies.set("fx_oauth_next", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
}

function resolveDisplayName(user: Record<string, unknown>, fallbackUserId: number): string {
  const candidates = [
    user.global_name,
    user.display_name,
    user.username,
    user.name
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return `Fluxer User ${fallbackUserId}`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const providerError = url.searchParams.get("error");

  if (providerError) {
    const response = redirectToPath("/login?error=oauth_denied");
    clearOauthCookies(response);
    return response;
  }

  const code = (url.searchParams.get("code") ?? "").trim();
  const state = (url.searchParams.get("state") ?? "").trim();
  const cookieStore = cookies();
  const stateCookie = cookieStore.get("fx_oauth_state")?.value ?? "";
  const nextCookieRaw = cookieStore.get("fx_oauth_next")?.value ?? null;
  const parsedState = parseOauthState(state);
  const nextPath = sanitizeNextPath(nextCookieRaw ?? parsedState?.nextPath ?? "/dashboard");
  const stateMatchesCookie = Boolean(state && stateCookie && stateCookie === state);
  const stateMatchesSignedToken = parsedState !== null;

  if (!code || !state || (!stateMatchesCookie && !stateMatchesSignedToken)) {
    const response = redirectToPath(`/login?error=oauth_state_mismatch&next=${encodeURIComponent(nextPath)}`);
    clearOauthCookies(response);
    return response;
  }

  try {
    const token = await exchangeFluxerCode(code);
    const user = (await fetchFluxerUser(token.access_token)) as Record<string, unknown>;

    const userId = Number(user.id ?? 0);
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new Error("Fluxer user id is missing from OAuth response");
    }

    const username = resolveDisplayName(user, userId);
    const sessionToken = createSessionToken(userId, username, token.access_token);

    const response = redirectToPath(nextPath);
    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
      secure: url.protocol === "https:"
    });

    clearOauthCookies(response);
    return response;
  } catch {
    const response = redirectToPath(`/login?error=oauth_failed&next=${encodeURIComponent(nextPath)}`);
    clearOauthCookies(response);
    return response;
  }
}
