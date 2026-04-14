import { NextRequest, NextResponse } from "next/server";

import { createReactionRolePanel, deleteReactionRolePanel, listReactionRolePanels } from "@/lib/db";
import { env } from "@/lib/env";
import { parseJsonBody } from "@/lib/http-body";
import { requireGuildContext, requireTotpAuthorization } from "@/lib/request-auth";

export const runtime = "nodejs";

const CUSTOM_EMOJI_RE = /^<(a?):([^:>]+):(\d{5,22})>$/;
const CUSTOM_NAME_ID_RE = /^([^:\s]+):(\d{5,22})$/;
const UNICODE_VARIATION_SELECTOR_RE = /\uFE0F/g;

type ParsedEmoji = {
  key: string;
  display: string;
  routeToken: string;
};

type MappingInput = {
  roleId: string;
  emojiKey: string;
  emojiDisplay: string;
  reactionRouteToken: string;
};

function toSnowflake(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return /^\d{5,22}$/.test(text) ? text : null;
}

function normalizeUnicodeEmojiKey(value: string): string {
  return String(value || "")
    .normalize("NFKC")
    .replace(UNICODE_VARIATION_SELECTOR_RE, "")
    .trim();
}

function parseEmojiInput(value: unknown): ParsedEmoji | null {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return null;
  }

  const mentionMatch = raw.match(CUSTOM_EMOJI_RE);
  if (mentionMatch) {
    const [, animatedPrefix, name, id] = mentionMatch;
    return {
      key: id,
      display: `<${animatedPrefix ? "a" : ""}:${name}:${id}>`,
      routeToken: `${name}:${id}`
    };
  }

  const nameIdMatch = raw.match(CUSTOM_NAME_ID_RE);
  if (nameIdMatch) {
    const [, name, id] = nameIdMatch;
    return {
      key: id,
      display: `<:${name}:${id}>`,
      routeToken: `${name}:${id}`
    };
  }

  const unicode = normalizeUnicodeEmojiKey(raw);
  if (!unicode) {
    return null;
  }

  return {
    key: unicode,
    display: unicode,
    routeToken: unicode
  };
}

function normalizeMappings(rawMappings: unknown): MappingInput[] {
  if (!Array.isArray(rawMappings)) {
    return [];
  }

  const dedupe = new Map<string, MappingInput>();
  for (const [index, entry] of rawMappings.entries()) {
    const item = entry as Record<string, unknown>;
    const roleId = toSnowflake(item?.roleId);
    const emoji = parseEmojiInput(item?.emoji);

    if (!roleId || !emoji) {
      throw new Error(`Invalid mapping at row ${index + 1}.`);
    }

    dedupe.set(`${emoji.key}:${roleId}`, {
      roleId,
      emojiKey: emoji.key,
      emojiDisplay: emoji.display,
      reactionRouteToken: emoji.routeToken
    });
  }

  return [...dedupe.values()];
}

function buildPanelEmbed(content: string): { description: string; color: number; title: string } {
  return {
    title: "Reaction Roles",
    description: content,
    color: 0x1f6feb
  };
}

async function fluxerBotRequest(path: string, init: RequestInit = {}): Promise<Response> {
  if (!env.botToken) {
    throw new Error("Bot token is not configured for dashboard actions.");
  }

  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bot ${env.botToken}`);

  const response = await fetch(`${env.fluxerApiBaseUrl}${path}`, {
    ...init,
    headers,
    cache: "no-store"
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Fluxer API ${response.status}: ${errorText || response.statusText}`);
  }

  return response;
}

async function sendReactionPanelMessage(channelId: string, content: string): Promise<{ messageId: string; channelId: string }> {
  const payload = {
    embeds: [buildPanelEmbed(content)]
  };

  const response = await fluxerBotRequest(`/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const raw = (await response.json()) as Record<string, unknown>;
  const messageId = toSnowflake(raw?.id);
  const resolvedChannelId = toSnowflake(raw?.channel_id) || channelId;

  if (!messageId) {
    throw new Error("Failed to resolve created panel message id.");
  }

  return {
    messageId,
    channelId: resolvedChannelId
  };
}

async function addReactionToMessage(channelId: string, messageId: string, reactionRouteToken: string): Promise<void> {
  await fluxerBotRequest(
    `/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(reactionRouteToken)}/@me`,
    {
      method: "PUT"
    }
  );
}

async function removeOwnReactionFromMessage(channelId: string, messageId: string, reactionRouteToken: string): Promise<void> {
  await fluxerBotRequest(
    `/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(reactionRouteToken)}/@me`,
    {
      method: "DELETE"
    }
  );
}

async function updateReactionPanelMessage(channelId: string, messageId: string, content: string): Promise<void> {
  const payload = {
    embeds: [buildPanelEmbed(content)]
  };

  await fluxerBotRequest(`/channels/${channelId}/messages/${messageId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

function routeTokenFromStoredMapping(emojiDisplay: string, emojiKey: string): string | null {
  const parsedDisplay = parseEmojiInput(emojiDisplay);
  if (parsedDisplay?.routeToken) {
    return parsedDisplay.routeToken;
  }

  const parsedKey = parseEmojiInput(emojiKey);
  if (parsedKey?.routeToken) {
    return parsedKey.routeToken;
  }

  return null;
}

async function deletePanelMessage(channelId: string, messageId: string): Promise<void> {
  await fluxerBotRequest(`/channels/${channelId}/messages/${messageId}`, {
    method: "DELETE"
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ guildId: string }> }
): Promise<NextResponse> {
  const { guildId } = await context.params;
  const auth = await requireGuildContext(request, guildId);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const panels = await listReactionRolePanels(guildId);
  return NextResponse.json({ panels });
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

  if (!env.botToken) {
    return NextResponse.json({ error: "Bot token missing. Set FLUXER_BOT_TOKEN on dashboard server." }, { status: 503 });
  }

  const parsedBody = await parseJsonBody<{
    channelId?: string;
    content?: string;
    mappings?: unknown;
  }>(request);

  if (!parsedBody.ok) {
    return NextResponse.json({ error: parsedBody.error }, { status: 400 });
  }

  const channelId = toSnowflake(parsedBody.data.channelId);
  if (!channelId) {
    return NextResponse.json({ error: "channelId is required." }, { status: 400 });
  }

  const content = String(parsedBody.data.content ?? "").trim();
  if (!content) {
    return NextResponse.json({ error: "content is required." }, { status: 400 });
  }

  if (content.length > 4096) {
    return NextResponse.json({ error: "content must be 4096 characters or fewer." }, { status: 400 });
  }

  let mappings: MappingInput[] = [];
  try {
    mappings = normalizeMappings(parsedBody.data.mappings);
  } catch (error) {
    return NextResponse.json(
      { error: String(error instanceof Error ? error.message : "Invalid reaction role mappings.") },
      { status: 400 }
    );
  }

  if (mappings.length === 0) {
    return NextResponse.json({ error: "At least one mapping is required." }, { status: 400 });
  }

  if (mappings.length > 20) {
    return NextResponse.json({ error: "Maximum 20 mappings are allowed per panel." }, { status: 400 });
  }

  let sentMessageId: string | null = null;
  let sentChannelId: string | null = null;

  try {
    const sent = await sendReactionPanelMessage(channelId, content);
    sentMessageId = sent.messageId;
    sentChannelId = sent.channelId;

    const reactionsAdded = new Set<string>();
    for (const mapping of mappings) {
      if (reactionsAdded.has(mapping.reactionRouteToken)) {
        continue;
      }

      await addReactionToMessage(sent.channelId, sent.messageId, mapping.reactionRouteToken);
      reactionsAdded.add(mapping.reactionRouteToken);
    }

    const panel = await createReactionRolePanel(guildId, {
      channelId: sent.channelId,
      messageId: sent.messageId,
      content,
      mappings: mappings.map((mapping) => ({
        emojiKey: mapping.emojiKey,
        emojiDisplay: mapping.emojiDisplay,
        roleId: mapping.roleId
      })),
      createdByUserId: auth.session.userId
    });

    return NextResponse.json({ panel }, { status: 201 });
  } catch (error) {
    if (sentChannelId && sentMessageId) {
      try {
        await deletePanelMessage(sentChannelId, sentMessageId);
      } catch {
        // Best effort cleanup.
      }
    }

    return NextResponse.json(
      { error: String(error instanceof Error ? error.message : "Failed to create reaction role panel.") },
      { status: 500 }
    );
  }
}

export async function PUT(
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

  if (!env.botToken) {
    return NextResponse.json({ error: "Bot token missing. Set FLUXER_BOT_TOKEN on dashboard server." }, { status: 503 });
  }

  const parsedBody = await parseJsonBody<{
    channelId?: string;
    messageId?: string;
    content?: string;
    mappings?: unknown;
  }>(request);

  if (!parsedBody.ok) {
    return NextResponse.json({ error: parsedBody.error }, { status: 400 });
  }

  const requestedMessageId = toSnowflake(parsedBody.data.messageId);
  const requestedChannelId = toSnowflake(parsedBody.data.channelId);
  if (!requestedMessageId) {
    return NextResponse.json({ error: "messageId is required." }, { status: 400 });
  }

  const content = String(parsedBody.data.content ?? "").trim();
  if (!content) {
    return NextResponse.json({ error: "content is required." }, { status: 400 });
  }

  if (content.length > 4096) {
    return NextResponse.json({ error: "content must be 4096 characters or fewer." }, { status: 400 });
  }

  let mappings: MappingInput[] = [];
  try {
    mappings = normalizeMappings(parsedBody.data.mappings);
  } catch (error) {
    return NextResponse.json(
      { error: String(error instanceof Error ? error.message : "Invalid reaction role mappings.") },
      { status: 400 }
    );
  }

  if (mappings.length === 0) {
    return NextResponse.json({ error: "At least one mapping is required." }, { status: 400 });
  }

  if (mappings.length > 20) {
    return NextResponse.json({ error: "Maximum 20 mappings are allowed per panel." }, { status: 400 });
  }

  const panels = await listReactionRolePanels(guildId);
  const existingPanel = panels.find(
    (panel) =>
      panel.message_id === requestedMessageId &&
      (!requestedChannelId || panel.channel_id === requestedChannelId)
  );

  if (!existingPanel) {
    return NextResponse.json({ error: "Reaction role panel not found." }, { status: 404 });
  }

  const nextTokens = new Set<string>();
  for (const mapping of mappings) {
    nextTokens.add(mapping.reactionRouteToken);
  }

  const previousTokens = new Set<string>();
  for (const mapping of existingPanel.mappings) {
    const token = routeTokenFromStoredMapping(mapping.emoji_display, mapping.emoji_key);
    if (token) {
      previousTokens.add(token);
    }
  }

  try {
    await updateReactionPanelMessage(existingPanel.channel_id, existingPanel.message_id, content);

    for (const token of nextTokens) {
      if (!previousTokens.has(token)) {
        await addReactionToMessage(existingPanel.channel_id, existingPanel.message_id, token);
      }
    }

    for (const token of previousTokens) {
      if (!nextTokens.has(token)) {
        try {
          await removeOwnReactionFromMessage(existingPanel.channel_id, existingPanel.message_id, token);
        } catch {
          // Best effort cleanup for removed mappings.
        }
      }
    }

    const panel = await createReactionRolePanel(guildId, {
      channelId: existingPanel.channel_id,
      messageId: existingPanel.message_id,
      content,
      mappings: mappings.map((mapping) => ({
        emojiKey: mapping.emojiKey,
        emojiDisplay: mapping.emojiDisplay,
        roleId: mapping.roleId
      })),
      createdByUserId: auth.session.userId
    });

    return NextResponse.json({ panel });
  } catch (error) {
    return NextResponse.json(
      { error: String(error instanceof Error ? error.message : "Failed to update reaction role panel.") },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

  let payload: Record<string, unknown> = {};
  try {
    const raw = (await request.json()) as unknown;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      payload = raw as Record<string, unknown>;
    }
  } catch {
    payload = {};
  }

  const requestUrl = new URL(request.url);
  const messageId = toSnowflake(payload.messageId || requestUrl.searchParams.get("messageId"));
  const channelId = toSnowflake(payload.channelId || requestUrl.searchParams.get("channelId"));

  if (!messageId) {
    return NextResponse.json({ error: "messageId is required." }, { status: 400 });
  }

  const existingPanel = (await listReactionRolePanels(guildId)).find((panel) => panel.message_id === messageId) || null;
  const resolvedChannelId = channelId || existingPanel?.channel_id || null;
  const removed = await deleteReactionRolePanel(guildId, messageId);

  if (resolvedChannelId && env.botToken) {
    try {
      await deletePanelMessage(resolvedChannelId, messageId);
    } catch {
      // Best effort cleanup.
    }
  }

  return NextResponse.json({ removed });
}
