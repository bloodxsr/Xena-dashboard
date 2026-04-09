import crypto from "node:crypto";

import { getEnv } from "@/lib/env";
import type { SessionPayload } from "@/lib/types";

export const SESSION_COOKIE_NAME = "fx_dash_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf-8").toString("base64url");
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf-8");
}

function signPayload(encodedPayload: string): string {
  return crypto.createHmac("sha256", getEnv().sessionSecret).update(encodedPayload).digest("base64url");
}

export function createSessionToken(userId: number, username: string, accessToken: string): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + SESSION_MAX_AGE_SECONDS;

  const payload: SessionPayload = {
    userId,
    username,
    accessToken,
    issuedAt,
    expiresAt
  };

  const encoded = encodeBase64Url(JSON.stringify(payload));
  const signature = signPayload(encoded);
  return `${encoded}.${signature}`;
}

export function parseSessionToken(token: string | null | undefined): SessionPayload | null {
  if (!token) {
    return null;
  }

  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) {
    return null;
  }

  const expectedSignature = signPayload(encoded);
  const sigBuffer = Buffer.from(signature, "utf-8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf-8");

  if (sigBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(encoded)) as SessionPayload;
    const now = Math.floor(Date.now() / 1000);

    if (!payload.userId || !payload.username || !payload.accessToken) {
      return null;
    }

    if (payload.expiresAt <= now) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
