import { NextResponse } from "next/server";

import { getEnv } from "@/lib/env";
import { buildFluxerLoginUrl } from "@/lib/fluxer";
import { sanitizeNextPath } from "@/lib/next-path";
import { createOauthState } from "@/lib/oauth-state";

function redirectToPath(path: string, status = 303): NextResponse {
  const response = new NextResponse(null, { status });
  response.headers.set("Location", path);
  return response;
}

function redirectToAbsolute(url: string, status = 303): NextResponse {
  const response = new NextResponse(null, { status });
  response.headers.set("Location", url);
  return response;
}

function buildLoginPath(nextPath: string, errorCode: string): string {
  const params = new URLSearchParams({ error: errorCode });
  if (nextPath !== "/dashboard") {
    params.set("next", nextPath);
  }
  return `/login?${params.toString()}`;
}

async function extractLoginInput(
  request: Request,
  url: URL
): Promise<{ nextPath: string; providedKey: string }> {
  const nextFromQuery = url.searchParams.get("next");
  const keyFromQuery = (url.searchParams.get("key") ?? "").trim();

  if (request.method !== "POST") {
    return {
      nextPath: sanitizeNextPath(nextFromQuery),
      providedKey: keyFromQuery
    };
  }

  let nextRaw = nextFromQuery;
  let providedKey = keyFromQuery;

  try {
    const form = await request.formData();
    const formNext = form.get("next");
    const formKey = form.get("key");

    if (typeof formNext === "string") {
      nextRaw = formNext;
    }
    if (typeof formKey === "string") {
      providedKey = formKey.trim();
    }
  } catch {
    // Fall back to query values when no form body is available.
  }

  return {
    nextPath: sanitizeNextPath(nextRaw),
    providedKey
  };
}

async function handleLogin(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const { nextPath, providedKey } = await extractLoginInput(request, url);

  const env = getEnv();
  const appOrigin = new URL(env.appBaseUrl).origin;
  if (url.origin !== appOrigin) {
    const canonicalUrl = new URL("/api/auth/login", env.appBaseUrl);
    canonicalUrl.searchParams.set("next", nextPath);
    if (providedKey) {
      canonicalUrl.searchParams.set("key", providedKey);
    }
    return redirectToAbsolute(canonicalUrl.toString());
  }

  const oauthConfigured = Boolean(env.fluxerClientId && env.fluxerClientSecret);
  if (!oauthConfigured) {
    return redirectToPath(buildLoginPath(nextPath, "oauth_config_missing"));
  }

  if (env.fluxerDashboardKey) {
    if (!providedKey) {
      return redirectToPath(buildLoginPath(nextPath, "key_required"));
    }

    if (providedKey !== env.fluxerDashboardKey) {
      return redirectToPath(buildLoginPath(nextPath, "key_invalid"));
    }
  }

  const state = createOauthState(nextPath);
  const response = new NextResponse(null, { status: 303 });
  response.headers.set("Location", buildFluxerLoginUrl(state));

  response.cookies.set("fx_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
    secure: url.protocol === "https:"
  });
  response.cookies.set("fx_oauth_next", nextPath, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
    secure: url.protocol === "https:"
  });

  return response;
}

export async function GET(request: Request) {
  return handleLogin(request);
}

export async function POST(request: Request) {
  return handleLogin(request);
}
