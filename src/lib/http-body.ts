import { NextRequest } from "next/server";

type JsonObject = Record<string, unknown>;

export async function parseJsonBody<T extends JsonObject = JsonObject>(
  request: NextRequest
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const payload = (await request.json()) as unknown;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return {
        ok: false,
        error: "Request body must be a JSON object."
      };
    }

    return {
      ok: true,
      data: payload as T
    };
  } catch {
    return {
      ok: false,
      error: "Invalid JSON body."
    };
  }
}