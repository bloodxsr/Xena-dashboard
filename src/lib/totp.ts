import crypto from "node:crypto";
import { env } from "@/lib/env";
import type { TotpRecord } from "@/lib/types";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeBase32Secret(secretBase32: string): string {
  const normalized = String(secretBase32 || "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/-/g, "")
    .replace(/=+$/g, "");

  if (!/^[A-Z2-7]+$/.test(normalized)) {
    throw new Error("Invalid base32 secret.");
  }

  return normalized;
}

function decodeBase32(secretBase32: string): Buffer {
  const normalized = normalizeBase32Secret(secretBase32);
  let bits = "";

  for (const character of normalized) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index < 0) {
      throw new Error("Invalid base32 secret.");
    }
    bits += index.toString(2).padStart(5, "0");
  }

  const bytes: number[] = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  }

  return Buffer.from(bytes);
}

function hotp(secretBase32: string, counter: number, digits = 6, algorithm = "sha1"): string {
  const normalizedDigits = clamp(Number(digits) || 6, 6, 8);
  const key = decodeBase32(secretBase32);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const digest = crypto.createHmac(String(algorithm || "sha1").toLowerCase(), key).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;

  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  const modulo = 10 ** normalizedDigits;
  return String(binary % modulo).padStart(normalizedDigits, "0");
}

export function normalizeTotpCode(rawCode: string): string {
  return String(rawCode || "").replace(/\D+/g, "");
}

export function generateTotpSecret(length = 32): string {
  const normalizedLength = clamp(Number(length) || 32, 16, 64);
  const bytes = crypto.randomBytes(Math.ceil((normalizedLength * 5) / 8));

  let bits = "";
  for (const byte of bytes) {
    bits += byte.toString(2).padStart(8, "0");
  }

  let output = "";
  for (let offset = 0; offset < bits.length; offset += 5) {
    const chunk = bits.slice(offset, offset + 5).padEnd(5, "0");
    output += BASE32_ALPHABET[Number.parseInt(chunk, 2)];
  }

  return output.slice(0, normalizedLength);
}

export function formatTotpSecret(secretBase32: string, chunkSize = 4): string {
  const normalized = normalizeBase32Secret(secretBase32);
  const size = clamp(Number(chunkSize) || 4, 2, 8);

  const groups: string[] = [];
  for (let offset = 0; offset < normalized.length; offset += size) {
    groups.push(normalized.slice(offset, offset + size));
  }

  return groups.join(" ");
}

export function verifyTotpCode(secretBase32: string, rawCode: string): boolean {
  const digits = env.totpCodeDigits;
  const normalizedCode = normalizeTotpCode(rawCode);
  if (normalizedCode.length !== digits) {
    return false;
  }

  const unixSeconds = Math.floor(Date.now() / 1000);
  const currentCounter = Math.floor(unixSeconds / env.totpPeriodSeconds);

  for (let offset = -env.totpVerifyWindowSteps; offset <= env.totpVerifyWindowSteps; offset += 1) {
    const candidateCounter = currentCounter + offset;
    if (candidateCounter < 0) {
      continue;
    }

    const candidate = hotp(secretBase32, candidateCounter, digits, "sha1");
    if (candidate === normalizedCode) {
      return true;
    }
  }

  return false;
}

export function buildTotpAuthUri(secretBase32: string, accountName: string): string {
  const normalizedSecret = normalizeBase32Secret(secretBase32);
  const issuer = env.totpIssuer;
  const normalizedAccountName = String(accountName || "staff").trim() || "staff";
  const label = `${issuer}:${normalizedAccountName}`;

  return (
    `otpauth://totp/${encodeURIComponent(label)}` +
    `?secret=${encodeURIComponent(normalizedSecret)}` +
    `&issuer=${encodeURIComponent(issuer)}` +
    `&algorithm=SHA1` +
    `&digits=${env.totpCodeDigits}` +
    `&period=${env.totpPeriodSeconds}`
  );
}

export function resolveTotpAuthorization(record: TotpRecord | null): {
  enrolled: boolean;
  authorized: boolean;
  last_verified_at: string | null;
  expires_at: string | null;
  remaining_days: number;
} {
  const enrolled = Boolean(record?.enabled && record?.secret_base32);
  const lastVerifiedAt = record?.last_verified_at ? String(record.last_verified_at) : null;

  if (!enrolled || !lastVerifiedAt) {
    return {
      enrolled,
      authorized: false,
      last_verified_at: lastVerifiedAt,
      expires_at: null,
      remaining_days: 0
    };
  }

  const verifiedAtMs = Date.parse(lastVerifiedAt);
  if (!Number.isFinite(verifiedAtMs)) {
    return {
      enrolled,
      authorized: false,
      last_verified_at: lastVerifiedAt,
      expires_at: null,
      remaining_days: 0
    };
  }

  const ttlMs = env.totpAuthWindowDays * ONE_DAY_MS;
  const expiresAtMs = verifiedAtMs + ttlMs;
  const remainingMs = expiresAtMs - Date.now();

  return {
    enrolled,
    authorized: remainingMs > 0,
    last_verified_at: lastVerifiedAt,
    expires_at: new Date(expiresAtMs).toISOString(),
    remaining_days: remainingMs > 0 ? Math.ceil(remainingMs / ONE_DAY_MS) : 0
  };
}
