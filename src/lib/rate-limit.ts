import type { NextRequest } from "next/server";

type Bucket = {
  hits: number;
  resetAtMs: number;
  blockedUntilMs: number;
};

type RateLimitOptions = {
  windowMs: number;
  maxHits: number;
  blockDurationMs?: number;
};

type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
};

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5000;

function normalizePositiveInteger(value: number, fallback: number): number {
  const parsed = Math.trunc(Number(value));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function pruneBuckets(nowMs: number): void {
  if (buckets.size <= MAX_BUCKETS) {
    return;
  }

  for (const [key, bucket] of buckets.entries()) {
    const expiredWindow = nowMs >= bucket.resetAtMs;
    const expiredBlock = !bucket.blockedUntilMs || nowMs >= bucket.blockedUntilMs;
    if (expiredWindow && expiredBlock) {
      buckets.delete(key);
    }
  }

  if (buckets.size <= MAX_BUCKETS) {
    return;
  }

  const overflow = buckets.size - MAX_BUCKETS;
  const keys = buckets.keys();
  for (let index = 0; index < overflow; index += 1) {
    const next = keys.next();
    if (next.done) {
      break;
    }

    buckets.delete(next.value);
  }
}

export function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp && realIp.trim()) {
    return realIp.trim();
  }

  return "unknown";
}

export function consumeRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const nowMs = Date.now();
  pruneBuckets(nowMs);

  const windowMs = normalizePositiveInteger(options.windowMs, 60_000);
  const maxHits = normalizePositiveInteger(options.maxHits, 1);
  const blockDurationMs = Math.max(0, Math.trunc(Number(options.blockDurationMs || 0)));

  let bucket = buckets.get(key);
  if (!bucket || nowMs >= bucket.resetAtMs) {
    bucket = {
      hits: 0,
      resetAtMs: nowMs + windowMs,
      blockedUntilMs: 0
    };
  }

  if (bucket.blockedUntilMs && nowMs < bucket.blockedUntilMs) {
    buckets.set(key, bucket);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.blockedUntilMs - nowMs) / 1000)),
      remaining: 0
    };
  }

  bucket.hits += 1;
  if (bucket.hits > maxHits) {
    if (blockDurationMs > 0) {
      bucket.blockedUntilMs = nowMs + blockDurationMs;
    }

    buckets.set(key, bucket);

    const retryUntilMs = bucket.blockedUntilMs > nowMs ? bucket.blockedUntilMs : bucket.resetAtMs;
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((retryUntilMs - nowMs) / 1000)),
      remaining: 0
    };
  }

  buckets.set(key, bucket);
  return {
    allowed: true,
    retryAfterSeconds: 0,
    remaining: Math.max(0, maxHits - bucket.hits)
  };
}

export function resetRateLimit(key: string): void {
  buckets.delete(key);
}