"use client";

import { useMemo, useState } from "react";

import { parseSnowflake } from "@/lib/snowflake";
import type {
  GuildConfig,
  GuildProfile,
  GuildRole,
  ModerationLog,
  PendingVerification,
  RaidGateState,
  WarningEntry
} from "@/lib/types";

type Props = {
  guildId: string;
  initialConfig: GuildConfig;
  initialProfile: GuildProfile | null;
  initialRaidState: RaidGateState;
  initialPending: PendingVerification[];
  initialWarnings: WarningEntry[];
  initialModerationLogs: ModerationLog[];
  initialBlacklistedWords: string[];
  initialRoles: GuildRole[];
  initialRolesError?: string | null;
};

type ActionState = {
  kind: "idle" | "saving" | "ok" | "error";
  message?: string;
};

type MemberAction = "kick" | "ban" | "unban" | "mute" | "unmute";
type RoleAction = "add_role" | "remove_role";

function parsePositiveInt(value: string): number | null {
  const parsed = Number(value.trim());
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function toWordsPayload(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[\n,]+/)
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

function metadataText(metadata: Record<string, unknown> | null): string {
  if (!metadata || Object.keys(metadata).length === 0) {
    return "-";
  }

  try {
    return JSON.stringify(metadata);
  } catch {
    return "[metadata]";
  }
}

export default function GuildConsole({
  guildId,
  initialConfig,
  initialProfile,
  initialRaidState,
  initialPending,
  initialWarnings,
  initialModerationLogs,
  initialBlacklistedWords,
  initialRoles,
  initialRolesError
}: Props) {
  const [config, setConfig] = useState<GuildConfig>(initialConfig);
  const [profile, setProfile] = useState<GuildProfile>(
    initialProfile ?? {
      guild_id: guildId,
      display_name: null,
      icon_url: null,
      updated_at: null
    }
  );
  const [raidState, setRaidState] = useState<RaidGateState>(initialRaidState);
  const [pending, setPending] = useState<PendingVerification[]>(initialPending);
  const [warnings, setWarnings] = useState<WarningEntry[]>(initialWarnings);
  const [moderationLogs, setModerationLogs] = useState<ModerationLog[]>(initialModerationLogs);
  const [blacklistedWords, setBlacklistedWords] = useState<string[]>(initialBlacklistedWords);
  const [wordsEditor, setWordsEditor] = useState<string>(initialBlacklistedWords.join("\n"));
  const [wordInput, setWordInput] = useState<string>("");
  const [roles, setRoles] = useState<GuildRole[]>(initialRoles);
  const [rolesError, setRolesError] = useState<string | null>(initialRolesError ?? null);

  const [memberAction, setMemberAction] = useState<MemberAction>("mute");
  const [memberTargetUserId, setMemberTargetUserId] = useState<string>("");
  const [memberReason, setMemberReason] = useState<string>("");
  const [muteDurationMinutes, setMuteDurationMinutes] = useState<string>("10");
  const [banDurationSeconds, setBanDurationSeconds] = useState<string>("0");
  const [deleteMessageDays, setDeleteMessageDays] = useState<string>("0");
  const [deleteMessageSeconds, setDeleteMessageSeconds] = useState<string>("0");

  const [roleAction, setRoleAction] = useState<RoleAction>("add_role");
  const [roleTargetUserId, setRoleTargetUserId] = useState<string>("");
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [roleReason, setRoleReason] = useState<string>("");

  const [warningTargetUserId, setWarningTargetUserId] = useState<string>("");
  const [warningCount, setWarningCount] = useState<string>("1");
  const [warningReason, setWarningReason] = useState<string>("");

  const [purgeChannelId, setPurgeChannelId] = useState<string>("");
  const [purgeAmount, setPurgeAmount] = useState<string>("10");
  const [purgeReason, setPurgeReason] = useState<string>("");

  const [saveState, setSaveState] = useState<ActionState>({ kind: "idle" });

  const sortedPending = useMemo(
    () => [...pending].sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [pending]
  );

  const sortedWarnings = useMemo(
    () => [...warnings].sort((a, b) => b.warning_count - a.warning_count || b.updated_at.localeCompare(a.updated_at)),
    [warnings]
  );

  const sortedLogs = useMemo(
    () => [...moderationLogs].sort((a, b) => b.id - a.id),
    [moderationLogs]
  );

  const sortedRoles = useMemo(
    () => [...roles].sort((a, b) => b.position - a.position || a.id.localeCompare(b.id)),
    [roles]
  );

  function setError(message: string) {
    setSaveState({ kind: "error", message });
  }

  function setSuccess(message: string) {
    setSaveState({ kind: "ok", message });
  }

  async function postJson(path: string, payload: unknown) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error ?? "Request failed");
    }
    return data;
  }

  async function getJson(path: string) {
    const response = await fetch(path, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error ?? "Request failed");
    }
    return data;
  }

  async function refreshWarnings() {
    const data = await getJson(`/api/guild/${guildId}/warnings?limit=100`);
    setWarnings(Array.isArray(data.items) ? (data.items as WarningEntry[]) : []);
  }

  async function refreshModerationLogs() {
    const data = await getJson(`/api/guild/${guildId}/moderation-logs?limit=100`);
    setModerationLogs(Array.isArray(data.items) ? (data.items as ModerationLog[]) : []);
  }

  async function refreshBlacklist() {
    const data = await getJson(`/api/guild/${guildId}/blacklist`);
    const words = Array.isArray(data.words) ? data.words.map((entry: unknown) => String(entry)) : [];
    setBlacklistedWords(words);
    setWordsEditor(words.join("\n"));
  }

  async function refreshRoles() {
    try {
      const data = await getJson(`/api/guild/${guildId}/roles`);
      setRoles(Array.isArray(data.items) ? (data.items as GuildRole[]) : []);
      setRolesError(null);
    } catch (error) {
      setRolesError(error instanceof Error ? error.message : "Failed to refresh roles");
    }
  }

  async function refreshPending() {
    const data = await getJson(`/api/guild/${guildId}/pending?limit=20`);
    setPending(Array.isArray(data.items) ? (data.items as PendingVerification[]) : []);
  }

  async function saveConfig() {
    setSaveState({ kind: "saving" });
    try {
      const payload = {
        verification_url: config.verification_url,
        raid_detection_enabled: config.raid_detection_enabled,
        raid_gate_threshold: Number(config.raid_gate_threshold),
        raid_join_rate_threshold: Number(config.raid_join_rate_threshold),
        raid_monitor_window_seconds: Number(config.raid_monitor_window_seconds),
        gate_duration_seconds: Number(config.gate_duration_seconds),
        join_gate_mode: config.join_gate_mode
      };

      const data = await postJson(`/api/guild/${guildId}/config`, payload);
      setConfig(data.config);
      setSuccess("Configuration saved.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Save failed");
    }
  }

  async function saveProfile() {
    setSaveState({ kind: "saving" });
    try {
      const data = await postJson(`/api/guild/${guildId}/profile`, {
        display_name: profile.display_name,
        icon_url: profile.icon_url
      });

      setProfile(data.profile as GuildProfile);
      setSuccess("Server profile saved. Refresh dashboard to see updated cards.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Profile save failed");
    }
  }

  async function setGate(active: boolean) {
    try {
      const data = await postJson(`/api/guild/${guildId}/raidgate`, {
        active,
        duration_seconds: Number(config.gate_duration_seconds),
        reason: "Updated from TypeScript dashboard"
      });
      setRaidState(data.state);
      setSuccess(`Raid gate ${active ? "enabled" : "disabled"}.`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Gate update failed");
    }
  }

  async function resolvePending(userId: number, action: "approve" | "reject") {
    const reason = window.prompt(`Reason for ${action} (optional):`) ?? "";

    try {
      await postJson(`/api/guild/${guildId}/verifications/${userId}`, {
        action,
        reason
      });
      setPending((prev) => prev.filter((row) => row.user_id !== userId));
      await refreshModerationLogs();
      setSuccess(`User ${userId} ${action}d.`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Action failed");
    }
  }

  async function executeMemberAction() {
    const targetUserId = parseSnowflake(memberTargetUserId);
    if (!targetUserId) {
      setError("Enter a valid target user ID.");
      return;
    }

    setSaveState({ kind: "saving" });
    try {
      const payload: Record<string, unknown> = {
        action: memberAction,
        target_user_id: targetUserId,
        reason: memberReason || "Updated from TypeScript dashboard"
      };

      if (memberAction === "mute") {
        payload.duration_minutes = Math.max(1, Math.min(Number(muteDurationMinutes || 10), 10080));
      }

      if (memberAction === "ban") {
        payload.ban_duration_seconds = Math.max(0, Math.min(Number(banDurationSeconds || 0), 31536000));
        payload.delete_message_days = Math.max(0, Math.min(Number(deleteMessageDays || 0), 7));
        payload.delete_message_seconds = Math.max(0, Math.min(Number(deleteMessageSeconds || 0), 604800));
      }

      await postJson(`/api/guild/${guildId}/member-actions`, payload);
      await refreshModerationLogs();
      setSuccess(`Member action '${memberAction}' executed for ${targetUserId}.`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Member action failed");
    }
  }

  async function executeRoleAction() {
    const targetUserId = parseSnowflake(roleTargetUserId);
    const roleId = parseSnowflake(selectedRoleId);
    if (!targetUserId) {
      setError("Enter a valid member ID for role action.");
      return;
    }
    if (!roleId) {
      setError("Select a valid role.");
      return;
    }

    setSaveState({ kind: "saving" });
    try {
      await postJson(`/api/guild/${guildId}/member-actions`, {
        action: roleAction,
        target_user_id: targetUserId,
        role_id: roleId,
        reason: roleReason || "Updated from TypeScript dashboard"
      });

      await refreshModerationLogs();
      setSuccess(`${roleAction === "add_role" ? "Added" : "Removed"} role ${roleId} for ${targetUserId}.`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Role action failed");
    }
  }

  async function executeWarningAction(action: "set" | "increment" | "reset") {
    const targetUserId = parsePositiveInt(warningTargetUserId);
    if (!targetUserId) {
      setError("Enter a valid user ID for warnings.");
      return;
    }

    setSaveState({ kind: "saving" });
    try {
      const payload: Record<string, unknown> = {
        action,
        reason: warningReason || "Updated from TypeScript dashboard"
      };

      if (action === "set") {
        payload.warning_count = Math.max(0, Math.min(Number(warningCount || 0), 999));
      }

      await postJson(`/api/guild/${guildId}/warnings/${targetUserId}`, payload);
      await refreshWarnings();
      await refreshModerationLogs();
      setSuccess(`Warning action '${action}' applied for ${targetUserId}.`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Warning action failed");
    }
  }

  async function executePurge() {
    const channelId = parseSnowflake(purgeChannelId);
    if (!channelId) {
      setError("Enter a valid channel ID for purge.");
      return;
    }

    setSaveState({ kind: "saving" });
    try {
      const data = await postJson(`/api/guild/${guildId}/purge`, {
        channel_id: channelId,
        amount: Math.max(1, Math.min(Number(purgeAmount || 10), 100)),
        reason: purgeReason || "Purge requested from TypeScript dashboard"
      });

      await refreshModerationLogs();
      setSuccess(
        `Purge completed in channel ${channelId}: ${Number(data.deleted ?? 0)} deleted${
          data.partial ? " (partial)" : ""
        }.`
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : "Purge failed");
    }
  }

  async function addBadWord() {
    const word = wordInput.trim().toLowerCase();
    if (!word) {
      setError("Enter a word or phrase to add.");
      return;
    }

    setSaveState({ kind: "saving" });
    try {
      const data = await postJson(`/api/guild/${guildId}/blacklist`, {
        action: "add",
        word
      });

      const words = Array.isArray(data.words) ? data.words.map((entry: unknown) => String(entry)) : [];
      setBlacklistedWords(words);
      setWordsEditor(words.join("\n"));
      setWordInput("");
      setSuccess(`Blacklist updated. Word ${data.changed ? "added" : "already existed"}.`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Blacklist update failed");
    }
  }

  async function removeBadWord() {
    const word = wordInput.trim().toLowerCase();
    if (!word) {
      setError("Enter a word or phrase to remove.");
      return;
    }

    setSaveState({ kind: "saving" });
    try {
      const data = await postJson(`/api/guild/${guildId}/blacklist`, {
        action: "remove",
        word
      });

      const words = Array.isArray(data.words) ? data.words.map((entry: unknown) => String(entry)) : [];
      setBlacklistedWords(words);
      setWordsEditor(words.join("\n"));
      setWordInput("");
      setSuccess(`Blacklist updated. Word ${data.changed ? "removed" : "not found"}.`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Blacklist update failed");
    }
  }

  async function replaceBadWords() {
    setSaveState({ kind: "saving" });
    try {
      const data = await postJson(`/api/guild/${guildId}/blacklist`, {
        action: "replace",
        words: toWordsPayload(wordsEditor)
      });

      const words = Array.isArray(data.words) ? data.words.map((entry: unknown) => String(entry)) : [];
      setBlacklistedWords(words);
      setWordsEditor(words.join("\n"));
      setSuccess(`Blacklist replaced with ${words.length} word(s).`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Blacklist replace failed");
    }
  }

  return (
    <>
      <section className="panel stack">
        <h2>Server Profile</h2>
        <p className="muted">Used for Fluxer dashboard card name and avatar.</p>

        <div className="row" style={{ alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "999px",
              border: "1px solid var(--border)",
              background: "#121212",
              overflow: "hidden",
              display: "grid",
              placeItems: "center"
            }}
          >
            {profile.icon_url ? (
              <img
                src={profile.icon_url}
                alt="Server profile icon preview"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <span className="mono" style={{ fontSize: "12px" }}>
                {(profile.display_name ?? `Guild ${guildId}`).slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>

          <div>
            <p className="mono" style={{ color: "var(--muted)" }}>
              Preview name
            </p>
            <p>{profile.display_name ?? `Guild ${guildId}`}</p>
          </div>
        </div>

        <div className="split">
          <label className="field">
            <span>Display Name</span>
            <input
              className="input"
              value={profile.display_name ?? ""}
              onChange={(event) => setProfile((prev) => ({ ...prev, display_name: event.target.value }))}
              placeholder="My Server Name"
            />
          </label>

          <label className="field">
            <span>Icon URL</span>
            <input
              className="input"
              value={profile.icon_url ?? ""}
              onChange={(event) => setProfile((prev) => ({ ...prev, icon_url: event.target.value }))}
              placeholder="https://.../icon.png"
            />
          </label>
        </div>

        <div className="row">
          <button className="btn" type="button" onClick={saveProfile}>
            Save Server Profile
          </button>
        </div>
      </section>

      <section className="panel split">
        <div className="stack">
          <h2>Raid Gate</h2>
          <p className="muted">
            Current state: <strong>{raidState.gate_active ? "ON" : "OFF"}</strong>
          </p>
          <p className="mono">Reason: {raidState.gate_reason ?? "-"}</p>
          <p className="mono">Until: {raidState.gate_until ?? "-"}</p>

          <div className="row">
            <button className="btn" type="button" onClick={() => setGate(true)}>
              Enable Gate
            </button>
            <button className="btn alt" type="button" onClick={() => setGate(false)}>
              Disable Gate
            </button>
          </div>
        </div>

        <div className="stack">
          <h2>Security Config</h2>

          <label className="field">
            <span>Verification URL (or off)</span>
            <input
              className="input"
              value={config.verification_url ?? ""}
              onChange={(event) => setConfig((prev) => ({ ...prev, verification_url: event.target.value }))}
              placeholder="https://example.com/verify or off"
            />
          </label>

          <label className="field">
            <span>Raid detection enabled</span>
            <select
              className="input"
              value={String(config.raid_detection_enabled)}
              onChange={(event) =>
                setConfig((prev) => ({ ...prev, raid_detection_enabled: event.target.value === "true" }))
              }
            >
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          </label>

          <div className="split">
            <label className="field">
              <span>Risk threshold</span>
              <input
                className="input"
                type="number"
                step="0.01"
                min={0.01}
                max={1}
                value={config.raid_gate_threshold}
                onChange={(event) =>
                  setConfig((prev) => ({ ...prev, raid_gate_threshold: Number(event.target.value || 0) }))
                }
              />
            </label>

            <label className="field">
              <span>Join rate threshold</span>
              <input
                className="input"
                type="number"
                min={2}
                max={100}
                value={config.raid_join_rate_threshold}
                onChange={(event) =>
                  setConfig((prev) => ({ ...prev, raid_join_rate_threshold: Number(event.target.value || 0) }))
                }
              />
            </label>
          </div>

          <div className="split">
            <label className="field">
              <span>Monitor window (seconds)</span>
              <input
                className="input"
                type="number"
                min={15}
                max={600}
                value={config.raid_monitor_window_seconds}
                onChange={(event) =>
                  setConfig((prev) => ({ ...prev, raid_monitor_window_seconds: Number(event.target.value || 0) }))
                }
              />
            </label>

            <label className="field">
              <span>Gate duration (seconds)</span>
              <input
                className="input"
                type="number"
                min={60}
                max={86400}
                value={config.gate_duration_seconds}
                onChange={(event) =>
                  setConfig((prev) => ({ ...prev, gate_duration_seconds: Number(event.target.value || 0) }))
                }
              />
            </label>
          </div>

          <label className="field">
            <span>Join gate mode</span>
            <select
              className="input"
              value={config.join_gate_mode}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  join_gate_mode: event.target.value === "kick" ? "kick" : "timeout"
                }))
              }
            >
              <option value="timeout">timeout</option>
              <option value="kick">kick</option>
            </select>
          </label>

          <div className="row">
            <button className="btn" type="button" onClick={saveConfig}>
              Save Configuration
            </button>
          </div>
        </div>
      </section>

      <section className="panel stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>Live Moderation Actions</h2>
          <span className="badge">Fluxer API</span>
        </div>

        <div className="split">
          <label className="field">
            <span>Target User ID</span>
            <input
              className="input"
              value={memberTargetUserId}
              onChange={(event) => setMemberTargetUserId(event.target.value)}
              placeholder="123456789012345678"
            />
          </label>

          <label className="field">
            <span>Action</span>
            <select
              className="input"
              value={memberAction}
              onChange={(event) => setMemberAction(event.target.value as MemberAction)}
            >
              <option value="mute">mute</option>
              <option value="unmute">unmute</option>
              <option value="kick">kick</option>
              <option value="ban">ban</option>
              <option value="unban">unban</option>
            </select>
          </label>
        </div>

        {memberAction === "mute" && (
          <label className="field">
            <span>Mute Duration (minutes)</span>
            <input
              className="input"
              type="number"
              min={1}
              max={10080}
              value={muteDurationMinutes}
              onChange={(event) => setMuteDurationMinutes(event.target.value)}
            />
          </label>
        )}

        {memberAction === "ban" && (
          <div className="split">
            <label className="field">
              <span>Ban Duration (seconds, 0 = permanent)</span>
              <input
                className="input"
                type="number"
                min={0}
                max={31536000}
                value={banDurationSeconds}
                onChange={(event) => setBanDurationSeconds(event.target.value)}
              />
            </label>

            <label className="field">
              <span>Delete Message Days (0-7)</span>
              <input
                className="input"
                type="number"
                min={0}
                max={7}
                value={deleteMessageDays}
                onChange={(event) => setDeleteMessageDays(event.target.value)}
              />
            </label>

            <label className="field">
              <span>Delete Message Seconds (0-604800)</span>
              <input
                className="input"
                type="number"
                min={0}
                max={604800}
                value={deleteMessageSeconds}
                onChange={(event) => setDeleteMessageSeconds(event.target.value)}
              />
            </label>
          </div>
        )}

        <label className="field">
          <span>Reason</span>
          <input
            className="input"
            value={memberReason}
            onChange={(event) => setMemberReason(event.target.value)}
            placeholder="Reason for moderation action"
          />
        </label>

        <div className="row">
          <button className="btn" type="button" onClick={executeMemberAction}>
            Execute Member Action
          </button>
        </div>
      </section>

      <section className="panel stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>Role Control</h2>
          <div className="row">
            <button className="btn alt" type="button" onClick={refreshRoles}>
              Refresh Roles
            </button>
            <span className="badge">{sortedRoles.length} role(s)</span>
          </div>
        </div>

        {rolesError ? <div className="alert warn">{rolesError}</div> : null}

        <div className="split">
          <label className="field">
            <span>Target User ID</span>
            <input
              className="input"
              value={roleTargetUserId}
              onChange={(event) => setRoleTargetUserId(event.target.value)}
              placeholder="123456789012345678"
            />
          </label>

          <label className="field">
            <span>Role Action</span>
            <select
              className="input"
              value={roleAction}
              onChange={(event) => setRoleAction(event.target.value as RoleAction)}
            >
              <option value="add_role">add_role</option>
              <option value="remove_role">remove_role</option>
            </select>
          </label>
        </div>

        <label className="field">
          <span>Role</span>
          <select className="input" value={selectedRoleId} onChange={(event) => setSelectedRoleId(event.target.value)}>
            <option value="">Select role</option>
            {sortedRoles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name} (id: {role.id}, pos: {role.position})
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Reason</span>
          <input
            className="input"
            value={roleReason}
            onChange={(event) => setRoleReason(event.target.value)}
            placeholder="Reason for role change"
          />
        </label>

        <div className="row">
          <button className="btn" type="button" onClick={executeRoleAction}>
            Apply Role Action
          </button>
        </div>
      </section>

      <section className="panel stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>Warnings</h2>
          <div className="row">
            <button className="btn alt" type="button" onClick={refreshWarnings}>
              Refresh Warnings
            </button>
            <span className="badge">{sortedWarnings.length} record(s)</span>
          </div>
        </div>

        <div className="split">
          <label className="field">
            <span>Target User ID</span>
            <input
              className="input"
              value={warningTargetUserId}
              onChange={(event) => setWarningTargetUserId(event.target.value)}
              placeholder="123456789012345678"
            />
          </label>

          <label className="field">
            <span>Warning Count (for set)</span>
            <input
              className="input"
              type="number"
              min={0}
              max={999}
              value={warningCount}
              onChange={(event) => setWarningCount(event.target.value)}
            />
          </label>
        </div>

        <label className="field">
          <span>Reason</span>
          <input
            className="input"
            value={warningReason}
            onChange={(event) => setWarningReason(event.target.value)}
            placeholder="Reason for warning update"
          />
        </label>

        <div className="row">
          <button className="btn" type="button" onClick={() => executeWarningAction("increment")}>
            Increment
          </button>
          <button className="btn" type="button" onClick={() => executeWarningAction("set")}>
            Set
          </button>
          <button className="btn alt" type="button" onClick={() => executeWarningAction("reset")}>
            Reset
          </button>
        </div>

        {sortedWarnings.length === 0 ? (
          <p className="muted">No warning records found.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Count</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {sortedWarnings.map((row) => (
                  <tr key={row.user_id}>
                    <td className="mono">{row.user_id}</td>
                    <td>{row.warning_count}</td>
                    <td className="mono">{row.updated_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel stack">
        <h2>Purge Channel Messages</h2>
        <p className="muted">Equivalent to bot /purge with safe limits and fallback deletion.</p>

        <div className="split">
          <label className="field">
            <span>Channel ID</span>
            <input
              className="input"
              value={purgeChannelId}
              onChange={(event) => setPurgeChannelId(event.target.value)}
              placeholder="123456789012345678"
            />
          </label>

          <label className="field">
            <span>Amount (1-100)</span>
            <input
              className="input"
              type="number"
              min={1}
              max={100}
              value={purgeAmount}
              onChange={(event) => setPurgeAmount(event.target.value)}
            />
          </label>
        </div>

        <label className="field">
          <span>Reason</span>
          <input
            className="input"
            value={purgeReason}
            onChange={(event) => setPurgeReason(event.target.value)}
            placeholder="Reason for purge"
          />
        </label>

        <div className="row">
          <button className="btn" type="button" onClick={executePurge}>
            Run Purge
          </button>
        </div>
      </section>

      <section className="panel stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>Blacklist Manager</h2>
          <div className="row">
            <button className="btn alt" type="button" onClick={refreshBlacklist}>
              Refresh Blacklist
            </button>
            <span className="badge">{blacklistedWords.length} word(s)</span>
          </div>
        </div>

        <label className="field">
          <span>Add / Remove Single Word</span>
          <input
            className="input"
            value={wordInput}
            onChange={(event) => setWordInput(event.target.value)}
            placeholder="word or phrase"
          />
        </label>

        <div className="row">
          <button className="btn" type="button" onClick={addBadWord}>
            Add
          </button>
          <button className="btn alt" type="button" onClick={removeBadWord}>
            Remove
          </button>
        </div>

        <label className="field">
          <span>Replace Entire Blacklist (one word per line or comma-separated)</span>
          <textarea
            className="input"
            rows={8}
            value={wordsEditor}
            onChange={(event) => setWordsEditor(event.target.value)}
            placeholder="word1\nword2"
          />
        </label>

        <div className="row">
          <button className="btn" type="button" onClick={replaceBadWords}>
            Replace Blacklist
          </button>
        </div>
      </section>

      {saveState.kind !== "idle" && (
        <section className="panel">
          <div
            className={`alert ${
              saveState.kind === "error"
                ? "error"
                : saveState.kind === "ok"
                  ? "success"
                  : "info"
            }`}
          >
            {saveState.message ?? (saveState.kind === "saving" ? "Applying update..." : "")}
          </div>
        </section>
      )}

      <section className="panel">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>Pending Verifications</h2>
          <button className="btn alt" type="button" onClick={refreshPending}>
            Refresh Pending
          </button>
        </div>
        {sortedPending.length === 0 ? (
          <p className="muted">No pending queue entries.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Risk</th>
                  <th>Reason</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedPending.map((row) => (
                  <tr key={row.user_id}>
                    <td className="mono">{row.user_id}</td>
                    <td>{row.risk_score.toFixed(3)}</td>
                    <td>{row.reason}</td>
                    <td className="mono">{row.updated_at}</td>
                    <td>
                      <div className="row">
                        <button className="btn" type="button" onClick={() => resolvePending(row.user_id, "approve")}>
                          Approve
                        </button>
                        <button
                          className="btn alt"
                          type="button"
                          onClick={() => resolvePending(row.user_id, "reject")}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>Moderation Logs</h2>
          <button className="btn alt" type="button" onClick={refreshModerationLogs}>
            Refresh Logs
          </button>
        </div>

        {sortedLogs.length === 0 ? (
          <p className="muted">No moderation logs available.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Target</th>
                  <th>Reason</th>
                  <th>Metadata</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {sortedLogs.map((row) => (
                  <tr key={row.id}>
                    <td className="mono">{row.id}</td>
                    <td>{row.action}</td>
                    <td className="mono">{row.actor_user_id ?? "-"}</td>
                    <td className="mono">{row.target_user_id ?? "-"}</td>
                    <td>{row.reason ?? "-"}</td>
                    <td className="mono">{metadataText(row.metadata)}</td>
                    <td className="mono">{row.created_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
