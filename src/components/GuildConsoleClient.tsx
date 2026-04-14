"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

const CHANNEL_FIELD_DEFINITIONS = [
  { key: "log_channel_id", label: "Log Channel" },
  { key: "welcome_channel_id", label: "Welcome Channel" },
  { key: "rules_channel_id", label: "Rules Channel" },
  { key: "chat_channel_id", label: "Chat Channel" },
  { key: "help_channel_id", label: "Help Channel" },
  { key: "about_channel_id", label: "About Channel" },
  { key: "perks_channel_id", label: "Perks Channel" },
  { key: "leveling_channel_id", label: "Leveling Channel" }
] as const;

const TEXT_LIKE_CHANNEL_TYPES = new Set([0, 5, 15]);

type ReactionRoleDraftRow = {
  emoji: string;
  roleId: string;
};

type LoadOverviewOptions = {
  silent?: boolean;
};

type CardBackgroundField = "level_card_background_url" | "welcome_card_background_url";

type OverviewPayload = {
  guild: {
    id: string;
    name: string;
    iconUrl: string | null;
  };
  config: {
    log_channel_id: string | null;
    welcome_channel_id: string | null;
    rules_channel_id: string | null;
    chat_channel_id: string | null;
    help_channel_id: string | null;
    about_channel_id: string | null;
    perks_channel_id: string | null;
    leveling_channel_id: string | null;
    verification_url: string | null;
    raid_gate_threshold: number;
    raid_monitor_window_seconds: number;
    raid_join_rate_threshold: number;
    gate_duration_seconds: number;
    join_gate_mode: "timeout" | "kick";
    welcome_message_template: string;
    levelup_message_template: string;
    kick_message_template: string;
    ban_message_template: string;
    mute_message_template: string;
    level_card_font: string;
    level_card_primary_color: string;
    level_card_accent_color: string;
    level_card_background_url: string | null;
    level_card_overlay_opacity: number;
    welcome_card_enabled: boolean;
    welcome_card_title_template: string;
    welcome_card_subtitle_template: string;
    welcome_card_font: string;
    welcome_card_primary_color: string;
    welcome_card_accent_color: string;
    welcome_card_background_url: string | null;
    welcome_card_overlay_opacity: number;
    ticket_enabled: boolean;
    ticket_trigger_channel_id: string | null;
    ticket_trigger_message_id: string | null;
    ticket_trigger_emoji: string;
    ticket_category_channel_id: string | null;
    ticket_support_role_id: string | null;
    ticket_welcome_template: string;
    admin_role_name: string;
    mod_role_name: string;
  };
  raidGate: {
    gate_active: boolean;
    gate_reason: string | null;
    gate_until: string | null;
  };
  warnings: Array<{
    user_id: string;
    warning_count: number;
    updated_at: string;
  }>;
  commandStates: Array<{
    command_name: string;
    enabled: boolean;
    updated_at: string;
  }>;
  topMembers: Array<{
    user_id: string;
    level: number;
    xp: number;
  }>;
  channels: Array<{
    id: string;
    guildId: string;
    name: string;
    type: number;
    position: number;
    parentId: string | null;
  }>;
  roles: Array<{
    id: string;
    guildId: string;
    name: string;
    color: number;
    position: number;
    managed: boolean;
    mentionable: boolean;
  }>;
  reactionRolePanels: Array<{
    guild_id: string;
    channel_id: string;
    message_id: string;
    content: string;
    created_at: string;
    updated_at: string;
    mappings: Array<{
      guild_id: string;
      channel_id: string;
      message_id: string;
      emoji_key: string;
      emoji_display: string;
      role_id: string;
      created_at: string;
    }>;
  }>;
  trackedMembers: number;
  totp: {
    enrolled: boolean;
    authorized: boolean;
    expires_at: string | null;
    remaining_days: number;
  };
};

function toInputValue(value: string | null | undefined): string {
  return value || "";
}

function numberInput(value: number): string {
  return Number.isFinite(value) ? String(value) : "";
}

function formatTimestamp(value: string | null | undefined): string {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleString();
}

function draftBool(value: string | null | undefined): boolean {
  const text = String(value || "").trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(text);
}

function boolDraftValue(value: boolean): string {
  return value ? "1" : "0";
}

function buildConfigDraft(config: OverviewPayload["config"]): Record<string, string> {
  return {
    log_channel_id: toInputValue(config.log_channel_id),
    welcome_channel_id: toInputValue(config.welcome_channel_id),
    rules_channel_id: toInputValue(config.rules_channel_id),
    chat_channel_id: toInputValue(config.chat_channel_id),
    help_channel_id: toInputValue(config.help_channel_id),
    about_channel_id: toInputValue(config.about_channel_id),
    perks_channel_id: toInputValue(config.perks_channel_id),
    leveling_channel_id: toInputValue(config.leveling_channel_id),
    verification_url: toInputValue(config.verification_url),
    raid_gate_threshold: numberInput(config.raid_gate_threshold),
    raid_monitor_window_seconds: numberInput(config.raid_monitor_window_seconds),
    raid_join_rate_threshold: numberInput(config.raid_join_rate_threshold),
    gate_duration_seconds: numberInput(config.gate_duration_seconds),
    join_gate_mode: config.join_gate_mode,
    welcome_message_template: config.welcome_message_template,
    levelup_message_template: config.levelup_message_template,
    kick_message_template: config.kick_message_template,
    ban_message_template: config.ban_message_template,
    mute_message_template: config.mute_message_template,
    level_card_font: config.level_card_font,
    level_card_primary_color: config.level_card_primary_color,
    level_card_accent_color: config.level_card_accent_color,
    level_card_background_url: toInputValue(config.level_card_background_url),
    level_card_overlay_opacity: numberInput(config.level_card_overlay_opacity),
    welcome_card_enabled: boolDraftValue(config.welcome_card_enabled),
    welcome_card_title_template: config.welcome_card_title_template,
    welcome_card_subtitle_template: config.welcome_card_subtitle_template,
    welcome_card_font: config.welcome_card_font,
    welcome_card_primary_color: config.welcome_card_primary_color,
    welcome_card_accent_color: config.welcome_card_accent_color,
    welcome_card_background_url: toInputValue(config.welcome_card_background_url),
    welcome_card_overlay_opacity: numberInput(config.welcome_card_overlay_opacity),
    ticket_enabled: boolDraftValue(config.ticket_enabled),
    ticket_trigger_channel_id: toInputValue(config.ticket_trigger_channel_id),
    ticket_trigger_message_id: toInputValue(config.ticket_trigger_message_id),
    ticket_trigger_emoji: config.ticket_trigger_emoji,
    ticket_category_channel_id: toInputValue(config.ticket_category_channel_id),
    ticket_support_role_id: toInputValue(config.ticket_support_role_id),
    ticket_welcome_template: config.ticket_welcome_template,
    admin_role_name: config.admin_role_name,
    mod_role_name: config.mod_role_name
  };
}

export function GuildConsoleClient({ guildId }: { guildId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [overview, setOverview] = useState<OverviewPayload | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [raidDuration, setRaidDuration] = useState("900");
  const [raidReason, setRaidReason] = useState("Dashboard toggle");
  const [configDraft, setConfigDraft] = useState<Record<string, string>>({});
  const [savingConfig, setSavingConfig] = useState(false);
  const [commandDraft, setCommandDraft] = useState<Record<string, boolean>>({});
  const [raidGateDraftEnabled, setRaidGateDraftEnabled] = useState(false);
  const [raidGateDraftDirty, setRaidGateDraftDirty] = useState(false);
  const [reactionPanelChannelId, setReactionPanelChannelId] = useState("");
  const [reactionPanelContent, setReactionPanelContent] = useState("");
  const [reactionPanelMappings, setReactionPanelMappings] = useState<ReactionRoleDraftRow[]>([{ emoji: "", roleId: "" }]);
  const [creatingReactionPanel, setCreatingReactionPanel] = useState(false);
  const [removingReactionPanelMessageId, setRemovingReactionPanelMessageId] = useState<string | null>(null);
  const [editingReactionPanel, setEditingReactionPanel] = useState<{ messageId: string; channelId: string } | null>(null);
  const [levelCardBackgroundFile, setLevelCardBackgroundFile] = useState<File | null>(null);
  const [welcomeCardBackgroundFile, setWelcomeCardBackgroundFile] = useState<File | null>(null);
  const [uploadingBackgroundTarget, setUploadingBackgroundTarget] = useState<CardBackgroundField | null>(null);

  const loadOverview = useCallback(async (options: LoadOverviewOptions = {}) => {
    const silent = Boolean(options.silent);
    if (!silent) {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await fetch(`/api/guild/${guildId}/overview`, { cache: "no-store" });
      const data = (await response.json()) as OverviewPayload | { error: string };
      if (!response.ok) {
        throw new Error((data as { error?: string }).error || "Failed to load guild overview.");
      }

      const payload = data as OverviewPayload;
      setOverview(payload);
      setConfigDraft(buildConfigDraft(payload.config));
      setCommandDraft(
        Object.fromEntries(payload.commandStates.map((entry) => [entry.command_name, entry.enabled]))
      );
      setRaidGateDraftEnabled(payload.raidGate.gate_active);
      setRaidGateDraftDirty(false);
      setRaidDuration(numberInput(payload.config.gate_duration_seconds));
    } catch (loadError) {
      setError(String(loadError instanceof Error ? loadError.message : loadError));
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [guildId]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const commandStates = useMemo(() => overview?.commandStates || [], [overview?.commandStates]);
  const persistedConfigDraft = useMemo(
    () => (overview ? buildConfigDraft(overview.config) : null),
    [overview]
  );
  const hasPendingConfigChanges = useMemo(() => {
    if (!persistedConfigDraft) {
      return false;
    }

    const keys = new Set([...Object.keys(persistedConfigDraft), ...Object.keys(configDraft)]);
    for (const key of keys) {
      if ((configDraft[key] ?? "") !== (persistedConfigDraft[key] ?? "")) {
        return true;
      }
    }

    return false;
  }, [configDraft, persistedConfigDraft]);
  const commandRows = useMemo(() => {
    return commandStates.map((entry) => {
      const stagedEnabled =
        Object.prototype.hasOwnProperty.call(commandDraft, entry.command_name)
          ? Boolean(commandDraft[entry.command_name])
          : entry.enabled;

      return {
        ...entry,
        stagedEnabled,
        dirty: stagedEnabled !== entry.enabled
      };
    });
  }, [commandDraft, commandStates]);
  const hasPendingCommandChanges = useMemo(
    () => commandRows.some((entry) => entry.dirty),
    [commandRows]
  );
  const hasPendingRaidGateChange = useMemo(() => {
    if (!overview) {
      return false;
    }

    return raidGateDraftDirty || raidGateDraftEnabled !== overview.raidGate.gate_active;
  }, [overview, raidGateDraftEnabled, raidGateDraftDirty]);
  const hasPendingSaveChanges = hasPendingConfigChanges || hasPendingCommandChanges || hasPendingRaidGateChange;
  const assignableChannels = useMemo(() => {
    const channels = overview?.channels || [];
    const filtered = channels.filter((channel) => TEXT_LIKE_CHANNEL_TYPES.has(channel.type));
    return filtered.length > 0 ? filtered : channels;
  }, [overview?.channels]);
  const assignableRoles = useMemo(() => {
    const roles = overview?.roles || [];
    return roles
      .filter((role) => role.id !== guildId)
      .sort((a, b) => b.position - a.position || a.name.localeCompare(b.name));
  }, [overview?.roles, guildId]);
  const warningSummary = useMemo(() => {
    const warnings = overview?.warnings || [];
    const total = warnings.reduce((sum, item) => sum + Math.max(0, Number(item.warning_count || 0)), 0);
    const highest = warnings.reduce((max, item) => Math.max(max, Math.max(0, Number(item.warning_count || 0))), 0);
    return {
      warnedUsers: warnings.length,
      totalWarnings: total,
      highestCount: highest
    };
  }, [overview?.warnings]);
  const levelCardPreviewStyle = useMemo(() => {
    const background = (configDraft.level_card_background_url || "").trim();
    const opacity = Math.max(0, Math.min(Number(configDraft.level_card_overlay_opacity || "0.38"), 1));
    return {
      "--card-primary": configDraft.level_card_primary_color || "#66f2c4",
      "--card-accent": configDraft.level_card_accent_color || "#6da8ff",
      "--card-overlay": String(opacity),
      backgroundImage: background ? `url(${background})` : undefined
    } as CSSProperties;
  }, [
    configDraft.level_card_primary_color,
    configDraft.level_card_accent_color,
    configDraft.level_card_overlay_opacity,
    configDraft.level_card_background_url
  ]);
  const welcomeCardPreviewStyle = useMemo(() => {
    const background = (configDraft.welcome_card_background_url || "").trim();
    const opacity = Math.max(0, Math.min(Number(configDraft.welcome_card_overlay_opacity || "0.48"), 1));
    return {
      "--card-primary": configDraft.welcome_card_primary_color || "#f8fafc",
      "--card-accent": configDraft.welcome_card_accent_color || "#6dd6ff",
      "--card-overlay": String(opacity),
      backgroundImage: background ? `url(${background})` : undefined
    } as CSSProperties;
  }, [
    configDraft.welcome_card_primary_color,
    configDraft.welcome_card_accent_color,
    configDraft.welcome_card_overlay_opacity,
    configDraft.welcome_card_background_url
  ]);

  useEffect(() => {
    if (reactionPanelChannelId || assignableChannels.length === 0) {
      return;
    }

    setReactionPanelChannelId(assignableChannels[0].id);
  }, [assignableChannels, reactionPanelChannelId]);

  async function saveConfig(): Promise<void> {
    if (!hasPendingSaveChanges) {
      setNotice("No pending changes to save.");
      return;
    }

    setNotice(null);
    setError(null);
    setSavingConfig(true);

    const failures: string[] = [];

    try {
      if (hasPendingConfigChanges) {
        const payload = {
          updates: {
            ...configDraft,
            raid_gate_threshold: Number(configDraft.raid_gate_threshold || "0.72"),
            raid_monitor_window_seconds: Number(configDraft.raid_monitor_window_seconds || "90"),
            raid_join_rate_threshold: Number(configDraft.raid_join_rate_threshold || "8"),
            gate_duration_seconds: Number(configDraft.gate_duration_seconds || "900"),
            level_card_overlay_opacity: Number(configDraft.level_card_overlay_opacity || "0.38"),
            welcome_card_overlay_opacity: Number(configDraft.welcome_card_overlay_opacity || "0.48"),
            welcome_card_enabled: draftBool(configDraft.welcome_card_enabled),
            ticket_enabled: draftBool(configDraft.ticket_enabled),
            join_gate_mode: configDraft.join_gate_mode === "kick" ? "kick" : "timeout"
          }
        };

        const response = await fetch(`/api/guild/${guildId}/config`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });

        const data = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) {
          failures.push(data.error || "Failed to save settings.");
        }
      }

      for (const entry of commandRows) {
        if (!entry.dirty) {
          continue;
        }

        const commandResponse = await fetch(`/api/guild/${guildId}/commands`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            commandName: entry.command_name,
            enabled: entry.stagedEnabled
          })
        });

        if (!commandResponse.ok) {
          const commandData = (await commandResponse.json().catch(() => ({}))) as { error?: string };
          failures.push(commandData.error || `Failed to update command: ${entry.command_name}`);
        }
      }

      if (overview && hasPendingRaidGateChange) {
        const gateResponse = await fetch(`/api/guild/${guildId}/raidgate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            enabled: raidGateDraftEnabled,
            durationSeconds: Number(raidDuration || "900"),
            reason: raidReason
          })
        });

        if (!gateResponse.ok) {
          const gateData = (await gateResponse.json().catch(() => ({}))) as { error?: string };
          failures.push(gateData.error || "Failed to update raid gate.");
        }
      }

      await loadOverview({ silent: true });

      if (failures.length > 0) {
        setError(failures.join(" | "));
      } else {
        setNotice("Changes saved.");
      }
    } catch {
      setError("Failed to save settings.");
    } finally {
      setSavingConfig(false);
    }
  }

  function toggleCommand(commandName: string, enabled: boolean): void {
    setError(null);
    setCommandDraft((prev) => ({
      ...prev,
      [commandName]: enabled
    }));
    setNotice(`Staged command change: ${commandName} ${enabled ? "enabled" : "disabled"}. Save Changes to apply.`);
  }

  async function setupTotp(rotate = false): Promise<void> {
    setError(null);
    const response = await fetch(`/api/guild/${guildId}/totp/setup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ rotate })
    });

    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
      dmSent?: boolean;
      setup?: { message?: string; secret?: string; otpauth_uri?: string };
    };

    if (!response.ok) {
      setError(data.error || "Failed to start TOTP setup.");
      return;
    }

    if (data.setup?.secret && data.setup?.otpauth_uri) {
      setNotice(`${data.setup.message || "TOTP setup ready."}\nSecret: ${data.setup.secret}\nURI: ${data.setup.otpauth_uri}`);
    } else {
      setNotice(data.setup?.message || "TOTP setup sent in DM.");
    }

    await loadOverview({ silent: true });
  }

  async function verifyTotp(): Promise<void> {
    setError(null);
    const response = await fetch(`/api/guild/${guildId}/totp/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ code: totpCode })
    });

    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setError(data.error || "Invalid code.");
      return;
    }

    setTotpCode("");
    setNotice("TOTP verified successfully.");
    await loadOverview({ silent: true });
  }

  function setRaidGate(enabled: boolean): void {
    setError(null);
    setRaidGateDraftEnabled(enabled);
    setRaidGateDraftDirty(true);
    setNotice(`Staged raid gate ${enabled ? "enable" : "disable"}. Save Changes to apply.`);
  }

  async function uploadCardBackground(target: CardBackgroundField, file: File | null): Promise<void> {
    if (!file) {
      setError("Select an image file before uploading.");
      return;
    }

    setError(null);
    setNotice(null);
    setUploadingBackgroundTarget(target);

    try {
      const formData = new FormData();
      formData.append("target", target);
      formData.append("file", file);

      const response = await fetch(`/api/guild/${guildId}/assets`, {
        method: "POST",
        body: formData
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string; url?: string };
      if (!response.ok || !data.url) {
        setError(data.error || "Failed to upload background image.");
        return;
      }

      setConfigDraft((prev) => ({
        ...prev,
        [target]: data.url as string
      }));

      if (target === "level_card_background_url") {
        setLevelCardBackgroundFile(null);
      } else {
        setWelcomeCardBackgroundFile(null);
      }

      setNotice("Background uploaded. Save Changes to apply it.");
    } finally {
      setUploadingBackgroundTarget(null);
    }
  }

  function clearCardBackground(target: CardBackgroundField): void {
    setConfigDraft((prev) => ({
      ...prev,
      [target]: ""
    }));

    if (target === "level_card_background_url") {
      setLevelCardBackgroundFile(null);
    } else {
      setWelcomeCardBackgroundFile(null);
    }

    setNotice("Background cleared. Save Changes to apply.");
  }

  function updateReactionMappingRow(index: number, patch: Partial<ReactionRoleDraftRow>): void {
    setReactionPanelMappings((prev) =>
      prev.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row))
    );
  }

  function addReactionMappingRow(): void {
    setReactionPanelMappings((prev) => [...prev, { emoji: "", roleId: "" }]);
  }

  function removeReactionMappingRow(index: number): void {
    setReactionPanelMappings((prev) => {
      const next = prev.filter((_row, rowIndex) => rowIndex !== index);
      return next.length > 0 ? next : [{ emoji: "", roleId: "" }];
    });
  }

  function beginReactionPanelEdit(panel: OverviewPayload["reactionRolePanels"][number]): void {
    setEditingReactionPanel({
      messageId: panel.message_id,
      channelId: panel.channel_id
    });
    setReactionPanelChannelId(panel.channel_id);
    setReactionPanelContent(panel.content || "");
    setReactionPanelMappings(
      panel.mappings.length > 0
        ? panel.mappings.map((mapping) => ({
            emoji: mapping.emoji_display,
            roleId: mapping.role_id
          }))
        : [{ emoji: "", roleId: "" }]
    );
    setError(null);
    setNotice(`Editing panel ${panel.message_id}.`);
  }

  function cancelReactionPanelEdit(): void {
    setEditingReactionPanel(null);
    setReactionPanelContent("");
    setReactionPanelMappings([{ emoji: "", roleId: "" }]);
    setError(null);
    setNotice("Panel edit cancelled.");
  }

  async function createReactionPanel(): Promise<void> {
    setError(null);
    setNotice(null);

    const channelId = (editingReactionPanel?.channelId || reactionPanelChannelId).trim();
    if (!channelId) {
      setError("Select a channel for the reaction role panel.");
      return;
    }

    const content = reactionPanelContent.trim();
    if (!content) {
      setError("Panel content is required.");
      return;
    }

    const mappings = reactionPanelMappings
      .map((row) => ({ emoji: row.emoji.trim(), roleId: row.roleId.trim() }))
      .filter((row) => row.emoji && row.roleId);

    if (mappings.length === 0) {
      setError("Add at least one emoji and role mapping.");
      return;
    }

    setCreatingReactionPanel(true);
    try {
      const isUpdate = Boolean(editingReactionPanel);
      const response = await fetch(`/api/guild/${guildId}/reaction-roles`, {
        method: isUpdate ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          channelId,
          messageId: editingReactionPanel?.messageId,
          content,
          mappings
        })
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(data.error || (isUpdate ? "Failed to update reaction role panel." : "Failed to create reaction role panel."));
        return;
      }

      setNotice(isUpdate ? "Reaction role panel updated." : "Reaction role panel created.");
      setEditingReactionPanel(null);
      setReactionPanelContent("");
      setReactionPanelMappings([{ emoji: "", roleId: "" }]);
      await loadOverview({ silent: true });
    } finally {
      setCreatingReactionPanel(false);
    }
  }

  async function removeReactionPanel(messageId: string, channelId: string): Promise<void> {
    setError(null);
    setNotice(null);
    setRemovingReactionPanelMessageId(messageId);

    try {
      const response = await fetch(`/api/guild/${guildId}/reaction-roles`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ messageId, channelId })
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(data.error || "Failed to remove reaction role panel.");
        return;
      }

      if (editingReactionPanel?.messageId === messageId) {
        setEditingReactionPanel(null);
        setReactionPanelContent("");
        setReactionPanelMappings([{ emoji: "", roleId: "" }]);
      }

      setNotice("Reaction role panel removed.");
      await loadOverview({ silent: true });
    } finally {
      setRemovingReactionPanelMessageId(null);
    }
  }

  if (loading) {
    return <div className="panel">Loading server console...</div>;
  }

  if (error && !overview) {
    return <div className="panel error">{error}</div>;
  }

  if (!overview) {
    return <div className="panel">No data available.</div>;
  }

  return (
    <div className="grid" style={{ gap: 14 }}>
      <section className="panel">
        <h2>{overview.guild.name}</h2>
        <p className="muted">Guild ID: {overview.guild.id}</p>
        {overview.totp.authorized ? (
          <p className="success">TOTP authorized for {overview.totp.remaining_days} day(s).</p>
        ) : (
          <p className="error">TOTP not authorized. Setup and verify before changing protected settings.</p>
        )}
      </section>

      {notice ? <div className="notice">{notice}</div> : null}
      {error ? <div className="notice error">{error}</div> : null}

      <section className="panel grid" style={{ gap: 12 }}>
        <h3>TOTP Authorization</h3>
        <div className="nav-actions">
          <button className="btn" onClick={() => void setupTotp(false)}>
            Setup TOTP
          </button>
          <button className="btn" onClick={() => void setupTotp(true)}>
            Rotate Secret
          </button>
        </div>
        <div className="nav-actions" style={{ alignItems: "center" }}>
          <input
            value={totpCode}
            onChange={(event) => setTotpCode(event.target.value)}
            placeholder="6-digit code"
            maxLength={8}
            style={{ maxWidth: 160 }}
          />
          <button className="btn primary" onClick={() => void verifyTotp()}>
            Verify Code
          </button>
        </div>
      </section>

      <section className="panel grid" style={{ gap: 12 }}>
        <h3>Server Configuration</h3>

        <div className="panel-subsection">
          <h4>Admin Settings</h4>
          <p className="muted">Control role labels and verification endpoint details for staff tools.</p>
          <div className="field-grid">
            <label>
              admin_role_name
              <input
                value={configDraft.admin_role_name || ""}
                onChange={(event) => setConfigDraft((prev) => ({ ...prev, admin_role_name: event.target.value }))}
                placeholder="Admin"
              />
            </label>
            <label>
              mod_role_name
              <input
                value={configDraft.mod_role_name || ""}
                onChange={(event) => setConfigDraft((prev) => ({ ...prev, mod_role_name: event.target.value }))}
                placeholder="Moderator"
              />
            </label>
            <label>
              verification_url
              <input
                value={configDraft.verification_url || ""}
                onChange={(event) => setConfigDraft((prev) => ({ ...prev, verification_url: event.target.value }))}
                placeholder="https://... or blank"
              />
            </label>
          </div>
        </div>

        <div className="panel-subsection">
          <h4>Channel Mapping</h4>
          <p className="muted">Select channels from your server directly instead of manually pasting IDs.</p>
          <div className="field-grid">
            {CHANNEL_FIELD_DEFINITIONS.map((field) => (
              <label key={field.key}>
                {field.label}
                <select
                  value={configDraft[field.key] || ""}
                  onChange={(event) => setConfigDraft((prev) => ({ ...prev, [field.key]: event.target.value }))}
                >
                  <option value="">none</option>
                  {assignableChannels.map((channel) => (
                    <option key={`${field.key}-${channel.id}`} value={channel.id}>
                      #{channel.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {assignableChannels.length === 0 ? (
            <p className="muted">No channels available. Ensure the bot token is set so the dashboard can fetch guild channels.</p>
          ) : null}
        </div>

        <div className="panel-subsection">
          <h4>Moderation Thresholds</h4>
          <div className="field-grid">
            <label>
              raid_gate_threshold
              <input
                value={configDraft.raid_gate_threshold || "0.72"}
                onChange={(event) => setConfigDraft((prev) => ({ ...prev, raid_gate_threshold: event.target.value }))}
              />
            </label>
            <label>
              raid_monitor_window_seconds
              <input
                value={configDraft.raid_monitor_window_seconds || "90"}
                onChange={(event) =>
                  setConfigDraft((prev) => ({ ...prev, raid_monitor_window_seconds: event.target.value }))
                }
              />
            </label>
            <label>
              raid_join_rate_threshold
              <input
                value={configDraft.raid_join_rate_threshold || "8"}
                onChange={(event) =>
                  setConfigDraft((prev) => ({ ...prev, raid_join_rate_threshold: event.target.value }))
                }
              />
            </label>
            <label>
              gate_duration_seconds
              <input
                value={configDraft.gate_duration_seconds || "900"}
                onChange={(event) =>
                  setConfigDraft((prev) => ({ ...prev, gate_duration_seconds: event.target.value }))
                }
              />
            </label>
            <label>
              join_gate_mode
              <select
                value={configDraft.join_gate_mode || "timeout"}
                onChange={(event) => setConfigDraft((prev) => ({ ...prev, join_gate_mode: event.target.value }))}
              >
                <option value="timeout">timeout</option>
                <option value="kick">kick</option>
              </select>
            </label>
          </div>
        </div>

        <button
          className="btn primary"
          onClick={() => void saveConfig()}
          disabled={savingConfig || !hasPendingSaveChanges}
        >
          {savingConfig ? "Saving..." : "Save Changes"}
        </button>
      </section>

      <div className="sticky-save-bar">
        <div className="sticky-save-bar-inner">
          <span className="muted">
            {hasPendingSaveChanges
              ? "Pending changes are staged across templates, cards, commands, and raid gate controls."
              : "No staged changes. Edit any setting to enable Save Changes."}
          </span>
          <button
            className="btn primary"
            onClick={() => void saveConfig()}
            disabled={savingConfig || !hasPendingSaveChanges}
          >
            {savingConfig ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      <section className="panel grid" style={{ gap: 10 }}>
        <h3>Message Templates</h3>
        <p className="muted">
          You can use placeholders like {"{user.mention}"}, {"{guild.name}"}, {"{reason}"}, {"{level}"}, and
          {" {rank}"}.
        </p>
        <div className="field-grid message-template-grid">
          <label>
            welcome_message_template
            <textarea
              value={configDraft.welcome_message_template || ""}
              onChange={(event) =>
                setConfigDraft((prev) => ({ ...prev, welcome_message_template: event.target.value }))
              }
            />
          </label>
          <label>
            levelup_message_template
            <textarea
              value={configDraft.levelup_message_template || ""}
              onChange={(event) =>
                setConfigDraft((prev) => ({ ...prev, levelup_message_template: event.target.value }))
              }
            />
          </label>
          <label>
            kick_message_template
            <textarea
              value={configDraft.kick_message_template || ""}
              onChange={(event) => setConfigDraft((prev) => ({ ...prev, kick_message_template: event.target.value }))}
            />
          </label>
          <label>
            ban_message_template
            <textarea
              value={configDraft.ban_message_template || ""}
              onChange={(event) => setConfigDraft((prev) => ({ ...prev, ban_message_template: event.target.value }))}
            />
          </label>
          <label>
            mute_message_template
            <textarea
              value={configDraft.mute_message_template || ""}
              onChange={(event) => setConfigDraft((prev) => ({ ...prev, mute_message_template: event.target.value }))}
            />
          </label>
        </div>
      </section>

      <section className="panel grid" style={{ gap: 12 }}>
        <h3>Level Card Studio</h3>
        <p className="muted">Style how rank cards look when members use rank commands.</p>

        <div className="field-grid">
          <label>
            level_card_font
            <select
              value={configDraft.level_card_font || "default"}
              onChange={(event) => setConfigDraft((prev) => ({ ...prev, level_card_font: event.target.value }))}
            >
              <option value="default">default</option>
              <option value="clean">clean</option>
              <option value="cyber">cyber</option>
            </select>
          </label>
          <label>
            level_card_primary_color
            <input
              type="color"
              value={configDraft.level_card_primary_color || "#66f2c4"}
              onChange={(event) =>
                setConfigDraft((prev) => ({ ...prev, level_card_primary_color: event.target.value }))
              }
            />
          </label>
          <label>
            level_card_accent_color
            <input
              type="color"
              value={configDraft.level_card_accent_color || "#6da8ff"}
              onChange={(event) =>
                setConfigDraft((prev) => ({ ...prev, level_card_accent_color: event.target.value }))
              }
            />
          </label>
          <label>
            level_card_overlay_opacity
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={configDraft.level_card_overlay_opacity || "0.38"}
              onChange={(event) =>
                setConfigDraft((prev) => ({ ...prev, level_card_overlay_opacity: event.target.value }))
              }
            />
          </label>
          <label style={{ gridColumn: "1 / -1" }}>
            level_card_background_image
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(event) => setLevelCardBackgroundFile(event.target.files?.[0] || null)}
            />
            <div className="nav-actions" style={{ marginTop: 8 }}>
              <button
                className="btn"
                type="button"
                onClick={() => void uploadCardBackground("level_card_background_url", levelCardBackgroundFile)}
                disabled={
                  !levelCardBackgroundFile ||
                  Boolean(uploadingBackgroundTarget && uploadingBackgroundTarget !== "level_card_background_url")
                }
              >
                {uploadingBackgroundTarget === "level_card_background_url" ? "Uploading..." : "Upload Image"}
              </button>
              <button
                className="btn"
                type="button"
                onClick={() => clearCardBackground("level_card_background_url")}
                disabled={
                  uploadingBackgroundTarget === "level_card_background_url" ||
                  (!configDraft.level_card_background_url && !levelCardBackgroundFile)
                }
              >
                Clear
              </button>
            </div>
            {configDraft.level_card_background_url ? (
              <a href={configDraft.level_card_background_url} target="_blank" rel="noreferrer" className="muted">
                Current background image
              </a>
            ) : (
              <span className="muted">No background image uploaded.</span>
            )}
          </label>
        </div>

        <article className="card-preview level-preview" style={levelCardPreviewStyle}>
          <div className="card-preview-overlay">
            <p className="muted">Rank #44</p>
            <h4>Enderman #0123</h4>
            <p>Level 12 • 429/1337 XP</p>
          </div>
        </article>
      </section>

      <section className="panel grid" style={{ gap: 12 }}>
        <h3>Welcome Card Studio</h3>
        <p className="muted">Control welcome visuals and copy sent for new members.</p>

        <div className="toggle-row">
          <div className="toggle-meta">
            <strong>welcome_card_enabled</strong>
            <span className="muted">Send a welcome card image when members join.</span>
          </div>
          <div className="toggle-control">
            <label className="switch" aria-label="toggle welcome card">
              <input
                type="checkbox"
                checked={draftBool(configDraft.welcome_card_enabled)}
                onChange={(event) =>
                  setConfigDraft((prev) => ({
                    ...prev,
                    welcome_card_enabled: boolDraftValue(event.target.checked)
                  }))
                }
              />
              <span className="switch-track">
                <span className="switch-thumb" />
              </span>
            </label>
          </div>
        </div>

        <div className="field-grid">
          <label>
            welcome_card_title_template
            <input
              value={configDraft.welcome_card_title_template || ""}
              onChange={(event) =>
                setConfigDraft((prev) => ({ ...prev, welcome_card_title_template: event.target.value }))
              }
            />
          </label>
          <label>
            welcome_card_subtitle_template
            <input
              value={configDraft.welcome_card_subtitle_template || ""}
              onChange={(event) =>
                setConfigDraft((prev) => ({ ...prev, welcome_card_subtitle_template: event.target.value }))
              }
            />
          </label>
          <label>
            welcome_card_font
            <select
              value={configDraft.welcome_card_font || "default"}
              onChange={(event) => setConfigDraft((prev) => ({ ...prev, welcome_card_font: event.target.value }))}
            >
              <option value="default">default</option>
              <option value="clean">clean</option>
              <option value="cinematic">cinematic</option>
            </select>
          </label>
          <label>
            welcome_card_primary_color
            <input
              type="color"
              value={configDraft.welcome_card_primary_color || "#f8fafc"}
              onChange={(event) =>
                setConfigDraft((prev) => ({ ...prev, welcome_card_primary_color: event.target.value }))
              }
            />
          </label>
          <label>
            welcome_card_accent_color
            <input
              type="color"
              value={configDraft.welcome_card_accent_color || "#6dd6ff"}
              onChange={(event) =>
                setConfigDraft((prev) => ({ ...prev, welcome_card_accent_color: event.target.value }))
              }
            />
          </label>
          <label>
            welcome_card_overlay_opacity
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={configDraft.welcome_card_overlay_opacity || "0.48"}
              onChange={(event) =>
                setConfigDraft((prev) => ({ ...prev, welcome_card_overlay_opacity: event.target.value }))
              }
            />
          </label>
          <label style={{ gridColumn: "1 / -1" }}>
            welcome_card_background_image
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(event) => setWelcomeCardBackgroundFile(event.target.files?.[0] || null)}
            />
            <div className="nav-actions" style={{ marginTop: 8 }}>
              <button
                className="btn"
                type="button"
                onClick={() => void uploadCardBackground("welcome_card_background_url", welcomeCardBackgroundFile)}
                disabled={
                  !welcomeCardBackgroundFile ||
                  Boolean(uploadingBackgroundTarget && uploadingBackgroundTarget !== "welcome_card_background_url")
                }
              >
                {uploadingBackgroundTarget === "welcome_card_background_url" ? "Uploading..." : "Upload Image"}
              </button>
              <button
                className="btn"
                type="button"
                onClick={() => clearCardBackground("welcome_card_background_url")}
                disabled={
                  uploadingBackgroundTarget === "welcome_card_background_url" ||
                  (!configDraft.welcome_card_background_url && !welcomeCardBackgroundFile)
                }
              >
                Clear
              </button>
            </div>
            {configDraft.welcome_card_background_url ? (
              <a href={configDraft.welcome_card_background_url} target="_blank" rel="noreferrer" className="muted">
                Current background image
              </a>
            ) : (
              <span className="muted">No background image uploaded.</span>
            )}
          </label>
        </div>

        <article className="card-preview welcome-preview" style={welcomeCardPreviewStyle}>
          <div className="card-preview-overlay">
            <h4>{configDraft.welcome_card_title_template || "Welcome to your server"}</h4>
            <p>
              {configDraft.welcome_card_subtitle_template ||
                "You're member #{server.member_count}. Make sure to read #rules."}
            </p>
          </div>
        </article>
      </section>

      <section className="panel grid" style={{ gap: 12 }}>
        <h3>Ticket System (Reaction Trigger)</h3>
        <p className="muted">Create support tickets when members react to one configured message.</p>

        <div className="toggle-row">
          <div className="toggle-meta">
            <strong>ticket_enabled</strong>
            <span className="muted">Enable automatic ticket channel creation from a reaction trigger.</span>
          </div>
          <div className="toggle-control">
            <label className="switch" aria-label="toggle ticket system">
              <input
                type="checkbox"
                checked={draftBool(configDraft.ticket_enabled)}
                onChange={(event) =>
                  setConfigDraft((prev) => ({ ...prev, ticket_enabled: boolDraftValue(event.target.checked) }))
                }
              />
              <span className="switch-track">
                <span className="switch-thumb" />
              </span>
            </label>
          </div>
        </div>

        <div className="field-grid">
          <label>
            ticket_trigger_channel_id
            <select
              value={configDraft.ticket_trigger_channel_id || ""}
              onChange={(event) =>
                setConfigDraft((prev) => ({ ...prev, ticket_trigger_channel_id: event.target.value }))
              }
            >
              <option value="">none</option>
              {assignableChannels.map((channel) => (
                <option key={`ticket-trigger-${channel.id}`} value={channel.id}>
                  #{channel.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            ticket_trigger_message_id
            <input
              value={configDraft.ticket_trigger_message_id || ""}
              onChange={(event) =>
                setConfigDraft((prev) => ({ ...prev, ticket_trigger_message_id: event.target.value.trim() }))
              }
              placeholder="message id"
            />
          </label>
          <label>
            ticket_trigger_emoji
            <input
              value={configDraft.ticket_trigger_emoji || "🎫"}
              onChange={(event) =>
                setConfigDraft((prev) => ({ ...prev, ticket_trigger_emoji: event.target.value }))
              }
              placeholder="🎫"
            />
          </label>
          <label>
            ticket_category_channel_id
            <select
              value={configDraft.ticket_category_channel_id || ""}
              onChange={(event) =>
                setConfigDraft((prev) => ({ ...prev, ticket_category_channel_id: event.target.value }))
              }
            >
              <option value="">none</option>
              {overview.channels.map((channel) => (
                <option key={`ticket-category-${channel.id}`} value={channel.id}>
                  {channel.type === 4 ? channel.name : `#${channel.name}`}
                </option>
              ))}
            </select>
          </label>
          <label>
            ticket_support_role_id
            <input
              value={configDraft.ticket_support_role_id || ""}
              onChange={(event) =>
                setConfigDraft((prev) => ({ ...prev, ticket_support_role_id: event.target.value.trim() }))
              }
              placeholder="role id"
            />
          </label>
        </div>

        <label>
          ticket_welcome_template
          <textarea
            value={configDraft.ticket_welcome_template || ""}
            onChange={(event) =>
              setConfigDraft((prev) => ({ ...prev, ticket_welcome_template: event.target.value }))
            }
          />
        </label>
      </section>

      <section className="panel grid" style={{ gap: 12 }}>
        <h3>Reaction Role Panel</h3>
        <p className="muted">
          Send one embed message with multiple emoji-to-role mappings, similar to MEE6 style reaction roles.
        </p>
        {editingReactionPanel ? (
          <p className="muted">
            Editing message {editingReactionPanel.messageId}. Save changes to update the existing panel.
          </p>
        ) : null}

        <div className="field-grid">
          <label>
            target_channel
            <select
              value={reactionPanelChannelId}
              onChange={(event) => setReactionPanelChannelId(event.target.value)}
              disabled={Boolean(editingReactionPanel)}
            >
              <option value="">select channel</option>
              {assignableChannels.map((channel) => (
                <option key={`reaction-panel-channel-${channel.id}`} value={channel.id}>
                  #{channel.name}
                </option>
              ))}
            </select>
          </label>
          <label style={{ gridColumn: "1 / -1" }}>
            panel_content
            <textarea
              value={reactionPanelContent}
              onChange={(event) => setReactionPanelContent(event.target.value)}
              placeholder="Pick your roles by reacting below."
              maxLength={4096}
            />
          </label>
        </div>

        <div className="panel-subsection">
          <h4>Mappings</h4>
          <div className="grid" style={{ gap: 10 }}>
            {reactionPanelMappings.map((row, index) => (
              <div className="field-grid" key={`reaction-mapping-${index}`}>
                <label>
                  emoji
                  <input
                    value={row.emoji}
                    onChange={(event) => updateReactionMappingRow(index, { emoji: event.target.value })}
                    placeholder="🎮 or <:name:id>"
                  />
                </label>
                <label>
                  role
                  <select
                    value={row.roleId}
                    onChange={(event) => updateReactionMappingRow(index, { roleId: event.target.value })}
                  >
                    <option value="">select role</option>
                    {assignableRoles.map((role) => (
                      <option key={`reaction-role-option-${role.id}`} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="nav-actions" style={{ alignItems: "end" }}>
                  <button
                    className="btn"
                    type="button"
                    onClick={() => removeReactionMappingRow(index)}
                    disabled={reactionPanelMappings.length <= 1}
                  >
                    Remove Row
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="nav-actions" style={{ marginTop: 10 }}>
            <button className="btn" type="button" onClick={() => addReactionMappingRow()}>
              Add Mapping Row
            </button>
            <button
              className="btn primary"
              type="button"
              onClick={() => void createReactionPanel()}
              disabled={creatingReactionPanel}
            >
              {creatingReactionPanel
                ? editingReactionPanel
                  ? "Saving..."
                  : "Creating..."
                : editingReactionPanel
                  ? "Save Panel Changes"
                  : "Send Reaction Panel"}
            </button>
            {editingReactionPanel ? (
              <button className="btn" type="button" onClick={() => cancelReactionPanelEdit()}>
                Cancel Edit
              </button>
            ) : null}
          </div>
          {assignableRoles.length === 0 ? (
            <p className="muted">No roles found. Ensure bot can fetch guild roles before creating a panel.</p>
          ) : null}
        </div>

        <div className="panel-subsection">
          <h4>Active Panels</h4>
          {overview.reactionRolePanels.length === 0 ? (
            <p className="muted">No reaction role panels created yet.</p>
          ) : (
            <div className="grid" style={{ gap: 10 }}>
              {overview.reactionRolePanels.map((panel) => {
                const channelName =
                  overview.channels.find((channel) => channel.id === panel.channel_id)?.name || panel.channel_id;

                return (
                  <article className="panel" key={`reaction-panel-${panel.message_id}`}>
                    <h4>Message {panel.message_id}</h4>
                    <p className="muted">Channel: #{channelName}</p>
                    <p>{panel.content}</p>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Emoji</th>
                          <th>Role</th>
                        </tr>
                      </thead>
                      <tbody>
                        {panel.mappings.map((mapping) => {
                          const roleName =
                            overview.roles.find((role) => role.id === mapping.role_id)?.name || mapping.role_id;
                          return (
                            <tr key={`${panel.message_id}-${mapping.emoji_key}-${mapping.role_id}`}>
                              <td>{mapping.emoji_display}</td>
                              <td>{roleName}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div className="nav-actions">
                      <button
                        className="btn"
                        type="button"
                        onClick={() => beginReactionPanelEdit(panel)}
                        disabled={creatingReactionPanel || removingReactionPanelMessageId === panel.message_id}
                      >
                        Edit Panel
                      </button>
                      <button
                        className="btn"
                        type="button"
                        disabled={removingReactionPanelMessageId === panel.message_id}
                        onClick={() => void removeReactionPanel(panel.message_id, panel.channel_id)}
                      >
                        {removingReactionPanelMessageId === panel.message_id ? "Removing..." : "Remove Panel"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="panel grid" style={{ gap: 12 }}>
        <h3>Raid Gate Actions</h3>
        <p className="muted">
          Current state: {overview.raidGate.gate_active ? "active" : "inactive"}
          {hasPendingRaidGateChange ? ` | staged: ${raidGateDraftEnabled ? "active" : "inactive"}` : ""}
        </p>
        <div className="field-grid">
          <label>
            durationSeconds
            <input value={raidDuration} onChange={(event) => setRaidDuration(event.target.value)} />
          </label>
          <label>
            reason
            <input value={raidReason} onChange={(event) => setRaidReason(event.target.value)} />
          </label>
        </div>
        <div className="nav-actions">
          <button className="btn" onClick={() => setRaidGate(true)}>
            Enable Raid Gate
          </button>
          <button className="btn" onClick={() => setRaidGate(false)}>
            Disable Raid Gate
          </button>
        </div>
      </section>

      <section className="panel grid" style={{ gap: 6 }}>
        <h3>Utilities and Command Controls</h3>
        <p className="muted">Toggle commands here, then use Save Changes once to apply everything.</p>
        {commandRows.map((entry) => (
          <div className="toggle-row" key={entry.command_name}>
            <div className="toggle-meta">
              <strong>{entry.command_name}</strong>
              <span className="muted">Updated {formatTimestamp(entry.updated_at)}</span>
            </div>
            <div className="toggle-control">
              <span className={`pill ${entry.stagedEnabled ? "status-on" : "status-off"}`}>
                {entry.stagedEnabled ? "enabled" : "disabled"}
              </span>
              {entry.dirty ? <span className="muted">staged</span> : null}
              <label className="switch" aria-label={`toggle ${entry.command_name}`}>
                <input
                  type="checkbox"
                  checked={entry.stagedEnabled}
                  onChange={(event) => toggleCommand(entry.command_name, event.target.checked)}
                />
                <span className="switch-track">
                  <span className="switch-thumb" />
                </span>
              </label>
            </div>
          </div>
        ))}
      </section>

      <section className="panel">
        <h3>Warning Counts</h3>
        <div className="stats-strip">
          <div className="stat-chip">
            <span className="muted">Members With Warnings</span>
            <strong>{warningSummary.warnedUsers}</strong>
          </div>
          <div className="stat-chip">
            <span className="muted">Total Warning Count</span>
            <strong>{warningSummary.totalWarnings}</strong>
          </div>
          <div className="stat-chip">
            <span className="muted">Highest User Count</span>
            <strong>{warningSummary.highestCount}</strong>
          </div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>User</th>
              <th>Warning Count</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {overview.warnings.map((warning, index) => (
              <tr key={warning.user_id}>
                <td>{index + 1}</td>
                <td>&lt;@{warning.user_id}&gt;</td>
                <td>{warning.warning_count} warning(s)</td>
                <td>{formatTimestamp(warning.updated_at)}</td>
              </tr>
            ))}
            {overview.warnings.length === 0 ? (
              <tr>
                <td colSpan={4} className="muted">
                  No warning records yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <h3>Top Level Members</h3>
        <p className="muted">Tracked members: {overview.trackedMembers}</p>
        <table className="table">
          <thead>
            <tr>
              <th>User</th>
              <th>Level</th>
              <th>XP</th>
            </tr>
          </thead>
          <tbody>
            {overview.topMembers.map((entry) => (
              <tr key={entry.user_id}>
                <td>&lt;@{entry.user_id}&gt;</td>
                <td>{entry.level}</td>
                <td>{entry.xp}</td>
              </tr>
            ))}
            {overview.topMembers.length === 0 ? (
              <tr>
                <td colSpan={3} className="muted">
                  No leveling data yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
