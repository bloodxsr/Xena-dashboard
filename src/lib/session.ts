import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import type { DashboardSession } from "@/lib/types";

const SESSION_COOKIE_NAME = "fluxer_dashboard_session";

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (normalized.length % 4)) % 4;
  return Buffer.from(`${normalized}${"=".repeat(padLength)}`, "base64").toString("utf-8");
}

function sign(raw: string): string {
  return crypto.createHmac("sha256", env.dashboardSessionSecret).update(raw).digest("base64url");
}

function timingSafeEqualString(expected: string, provided: string): boolean {
  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(provided, "utf8");

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

export function createSessionToken(session: DashboardSession): string {
  const encoded = encodeBase64Url(JSON.stringify(session));
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
}

export function parseSessionToken(token: string | undefined | null): DashboardSession | null {
  if (!token || !token.includes(".")) {
    return null;
  }

  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) {
    return null;
  }

  if (!timingSafeEqualString(sign(encoded), signature)) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeBase64Url(encoded)) as DashboardSession;
    const expiresAtMs = Date.parse(String(parsed.expiresAt || ""));
    if (!Number.isFinite(expiresAtMs) || Date.now() >= expiresAtMs) {
      return null;
    }

    if (!parsed.userId || !parsed.accessToken) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function readSessionFromRequest(request: NextRequest): DashboardSession | null {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  return parseSessionToken(token);
}

export function writeSessionCookie(response: NextResponse, session: DashboardSession): void {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: createSessionToken(session),
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: "lax",
    path: "/",
    maxAge: env.dashboardSessionTtlSeconds
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
}
