import type { NextRequest } from "next/server";
import { handleOAuthCallback } from "@/lib/oauth-callback-handler";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return handleOAuthCallback(request);
}
