import { NextRequest, NextResponse } from "next/server";
import { fetchCurrentUser } from "@/lib/fluxer";
import { requireSession, resolveCommonGuilds } from "@/lib/request-auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = requireSession(request);
  if (session instanceof NextResponse) {
    return NextResponse.json({ authenticated: false, user: null, guilds: [] }, { status: 200 });
  }

  try {
    const [liveUser, guilds] = await Promise.all([
      fetchCurrentUser(session.accessToken).catch(() => ({
        id: session.userId,
        username: session.username,
        globalName: session.username,
        avatarUrl: session.avatarUrl
      })),
      resolveCommonGuilds(session)
    ]);

    return NextResponse.json({
      authenticated: true,
      user: {
        id: liveUser.id,
        username: liveUser.globalName || liveUser.username,
        avatarUrl: liveUser.avatarUrl
      },
      guilds
    });
  } catch (error) {
    console.error("session route failed", error);
    return NextResponse.json(
      {
        authenticated: false,
        error: "Failed to refresh session."
      },
      { status: 401 }
    );
  }
}
