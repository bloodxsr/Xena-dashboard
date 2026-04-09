import crypto from "node:crypto";

import { getEnv } from "@/lib/env";
import { sanitizeNextPath } from "@/lib/next-path";

type OauthStatePayload = {
  nonce: string;
  nextPath: string;
  iat: number;
};

function sign(data: string): string {
  return crypto.createHmac("sha256", getEnv().sessionSecret).update(data).digest("base64url");
}

export function createOauthState(nextPath: string): string {
  const payload: OauthStatePayload = {
    nonce: crypto.randomBytes(24).toString("hex"),
    nextPath: sanitizeNextPath(nextPath),
    iat: Date.now()
  };

  const data = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
  const signature = sign(data);
  return `${data}.${signature}`;
}

export function parseOauthState(token: string, maxAgeSeconds = 600): OauthStatePayload | null {
  const raw = String(token ?? "").trim();
  if (!raw || !raw.includes(".")) {
    return null;
  }

  const [data, providedSig] = raw.split(".", 2);
  if (!data || !providedSig) {
    return null;
  }

  const expectedSig = sign(data);
  const providedBuffer = Buffer.from(providedSig, "utf-8");
  const expectedBuffer = Buffer.from(expectedSig, "utf-8");

  if (providedBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const json = Buffer.from(data, "base64url").toString("utf-8");
    const decoded = JSON.parse(json) as Partial<OauthStatePayload>;

    const nonce = typeof decoded.nonce === "string" ? decoded.nonce.trim() : "";
    const nextPath = sanitizeNextPath(decoded.nextPath ?? "/dashboard");
    const iat = Number(decoded.iat ?? 0);

    if (!nonce || !Number.isFinite(iat) || iat <= 0) {
      return null;
    }

    const ageMs = Date.now() - iat;
    if (ageMs < 0 || ageMs > maxAgeSeconds * 1000) {
      return null;
    }

    return { nonce, nextPath, iat };
  } catch {
    return null;
  }
}
