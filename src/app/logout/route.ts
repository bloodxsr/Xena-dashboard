import { NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/session";

function redirectToPath(path: string, status = 303): NextResponse {
  const response = new NextResponse(null, { status });
  response.headers.set("Location", path);
  return response;
}

export async function GET(request: Request) {
  const response = redirectToPath("/");
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
  return response;
}
