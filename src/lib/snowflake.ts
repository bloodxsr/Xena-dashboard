const SNOWFLAKE_REGEX = /^\d{5,22}$/;

export function parseSnowflake(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!SNOWFLAKE_REGEX.test(text)) {
    return null;
  }
  return text;
}

export function toMaybeNumber(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}
