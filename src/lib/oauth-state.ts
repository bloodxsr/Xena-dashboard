import crypto from "node:crypto";
import { env } from "@/lib/env";

const DEFAULT_TTL_SECONDS = 600;

function signPayload(payload: string): string {
  return crypto.createHmac("sha256", env.dashboardSessionSecret).update(payload).digest("hex");
}

export function createSignedOAuthState(ttlSeconds = DEFAULT_TTL_SECONDS): string {
  const nonce = crypto.randomBytes(18).toString("hex");
  const issuedAtSeconds = Math.floor(Date.now() / 1000);
  const maxAge = Math.max(30, Math.trunc(ttlSeconds));
  const payload = `${nonce}.${issuedAtSeconds}.${maxAge}`;
  const signature = signPayload(payload);
  return `${payload}.${signature}`;
}

export function verifySignedOAuthState(state: string): boolean {
  const normalized = String(state || "").trim();
  const parts = normalized.split(".");
  if (parts.length !== 4) {
    return false;
  }

  const [nonce, issuedAtRaw, maxAgeRaw, signature] = parts;
  if (!/^[a-f0-9]{36}$/i.test(nonce) || !/^[a-f0-9]{64}$/i.test(signature)) {
    return false;
  }

  const issuedAtSeconds = Number(issuedAtRaw);
  const maxAge = Number(maxAgeRaw);
  if (!Number.isFinite(issuedAtSeconds) || !Number.isFinite(maxAge)) {
    return false;
  }

  const boundedMaxAge = Math.max(30, Math.min(3600, Math.trunc(maxAge)));
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (nowSeconds - issuedAtSeconds > boundedMaxAge || issuedAtSeconds - nowSeconds > 30) {
    return false;
  }

  const payload = `${nonce}.${issuedAtRaw}.${maxAgeRaw}`;
  const expected = signPayload(payload);
  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(signature, "utf8");
  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}