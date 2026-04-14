import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { requireGuildContext, requireTotpAuthorization } from "@/lib/request-auth";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;
const ALLOWED_TARGETS = new Set(["level_card_background_url", "welcome_card_background_url"]);
const ALLOWED_MIME_EXTENSIONS: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif"
};
const ALLOWED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

function resolveFileExtension(file: File): string | null {
  const mimeType = String(file.type || "").toLowerCase();
  if (mimeType && ALLOWED_MIME_EXTENSIONS[mimeType]) {
    return ALLOWED_MIME_EXTENSIONS[mimeType];
  }

  const match = /\.([a-zA-Z0-9]+)$/.exec(file.name || "");
  if (!match) {
    return null;
  }

  const extension = `.${match[1].toLowerCase()}`;
  return ALLOWED_EXTENSIONS.has(extension) ? extension : null;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ guildId: string }> }
): Promise<NextResponse> {
  const { guildId } = await context.params;
  const auth = await requireGuildContext(request, guildId);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const totpCheck = await requireTotpAuthorization(guildId, auth.session.userId);
  if (!totpCheck.ok) {
    return NextResponse.json({ error: totpCheck.error }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const target = formData.get("target");
    const file = formData.get("file");

    if (typeof target !== "string" || !ALLOWED_TARGETS.has(target)) {
      return NextResponse.json({ error: "Invalid upload target." }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No image file uploaded." }, { status: 400 });
    }

    if (file.size <= 0) {
      return NextResponse.json({ error: "Uploaded image is empty." }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "Image is too large. Maximum size is 6MB." },
        { status: 400 }
      );
    }

    const extension = resolveFileExtension(file);
    if (!extension) {
      return NextResponse.json(
        { error: "Unsupported image format. Use PNG, JPG, WEBP, or GIF." },
        { status: 400 }
      );
    }

    const uploadsDirectory = path.join(process.cwd(), "public", "uploads", "guild-assets", guildId);
    await mkdir(uploadsDirectory, { recursive: true });

    const fileName = `${target}-${Date.now()}-${randomUUID().slice(0, 8)}${extension}`;
    const diskPath = path.join(uploadsDirectory, fileName);

    const imageBuffer = Buffer.from(await file.arrayBuffer());
    await writeFile(diskPath, imageBuffer);

    const relativeUrl = path.posix.join("/uploads", "guild-assets", guildId, fileName);
    const publicUrl = new URL(relativeUrl, request.nextUrl.origin).toString();
    return NextResponse.json({ url: publicUrl, target });
  } catch {
    return NextResponse.json({ error: "Failed to store uploaded image." }, { status: 500 });
  }
}
