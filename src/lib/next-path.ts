const BLOCKED_PREFIXES = [
  "/login",
  "/logout",
  "/api/",
  "/oauth/"
];

export function sanitizeNextPath(raw: string | null | undefined, fallback = "/dashboard"): string {
  if (!raw) {
    return fallback;
  }

  const value = raw.trim();
  if (!value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  const lower = value.toLowerCase();
  if (BLOCKED_PREFIXES.some((prefix) => lower === prefix || lower.startsWith(prefix))) {
    return fallback;
  }

  return value;
}
