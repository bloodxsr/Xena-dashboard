"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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

export function GuildConsoleClient({ guildId }: { guildId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [overview, setOverview] = useState<OverviewPayload | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [raidDuration, setRaidDuration] = useState("900");
  const [raidReason, setRaidReason] = useState("Dashboard toggle");
  const [configDraft, setConfigDraft] = useState<Record<string, string>>({});

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/guild/${guildId}/overview`, { cache: "no-store" });
      const data = (await response.json()) as OverviewPayload | { error: string };
      if (!response.ok) {
        throw new Error((data as { error?: string }).error || "Failed to load guild overview.");
      }

      const payload = data as OverviewPayload;
      setOverview(payload);
      setConfigDraft({
        log_channel_id: toInputValue(payload.config.log_channel_id),
        welcome_channel_id: toInputValue(payload.config.welcome_channel_id),
        rules_channel_id: toInputValue(payload.config.rules_channel_id),
        chat_channel_id: toInputValue(payload.config.chat_channel_id),
        help_channel_id: toInputValue(payload.config.help_channel_id),
        about_channel_id: toInputValue(payload.config.about_channel_id),
        perks_channel_id: toInputValue(payload.config.perks_channel_id),
        leveling_channel_id: toInputValue(payload.config.leveling_channel_id),
        verification_url: toInputValue(payload.config.verification_url),
        raid_gate_threshold: numberInput(payload.config.raid_gate_threshold),
        raid_monitor_window_seconds: numberInput(payload.config.raid_monitor_window_seconds),
        raid_join_rate_threshold: numberInput(payload.config.raid_join_rate_threshold),
        gate_duration_seconds: numberInput(payload.config.gate_duration_seconds),
        join_gate_mode: payload.config.join_gate_mode,
        welcome_message_template: payload.config.welcome_message_template,
        levelup_message_template: payload.config.levelup_message_template,
        kick_message_template: payload.config.kick_message_template,
        ban_message_template: payload.config.ban_message_template,
        mute_message_template: payload.config.mute_message_template,
        admin_role_name: payload.config.admin_role_name,
        mod_role_name: payload.config.mod_role_name
      });
      setRaidDuration(numberInput(payload.config.gate_duration_seconds));
    } catch (loadError) {
      setError(String(loadError instanceof Error ? loadError.message : loadError));
    } finally {
      setLoading(false);
    }
  }, [guildId]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const commandStates = useMemo(() => overview?.commandStates || [], [overview?.commandStates]);
  const assignableChannels = useMemo(() => {
    const channels = overview?.channels || [];
    const filtered = channels.filter((channel) => TEXT_LIKE_CHANNEL_TYPES.has(channel.type));
    return filtered.length > 0 ? filtered : channels;
  }, [overview?.channels]);
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

  async function saveConfig(): Promise<void> {
    setNotice(null);
    setError(null);

    const payload = {
      updates: {
        ...configDraft,
        raid_gate_threshold: Number(configDraft.raid_gate_threshold || "0.72"),
        raid_monitor_window_seconds: Number(configDraft.raid_monitor_window_seconds || "90"),
        raid_join_rate_threshold: Number(configDraft.raid_join_rate_threshold || "8"),
        gate_duration_seconds: Number(configDraft.gate_duration_seconds || "900"),
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
      setError(data.error || "Failed to save settings.");
      return;
    }

    setNotice("Settings saved.");
    await loadOverview();
  }

  async function toggleCommand(commandName: string, enabled: boolean): Promise<void> {
    setError(null);
    const response = await fetch(`/api/guild/${guildId}/commands`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ commandName, enabled })
    });

    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setError(data.error || "Failed to update command toggle.");
      return;
    }

    setNotice(`${commandName} ${enabled ? "enabled" : "disabled"}.`);
    await loadOverview();
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

    await loadOverview();
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
    await loadOverview();
  }

  async function setRaidGate(enabled: boolean): Promise<void> {
    setError(null);
    const response = await fetch(`/api/guild/${guildId}/raidgate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ enabled, durationSeconds: Number(raidDuration || "900"), reason: raidReason })
    });

    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setError(data.error || "Failed to update raid gate.");
      return;
    }

    setNotice(`Raid gate ${enabled ? "enabled" : "disabled"}.`);
    await loadOverview();
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

        <button className="btn primary" onClick={() => void saveConfig()}>
          Save Settings
        </button>
      </section>

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
        <h3>Raid Gate Actions</h3>
        <p className="muted">Current state: {overview.raidGate.gate_active ? "active" : "inactive"}</p>
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
          <button className="btn" onClick={() => void setRaidGate(true)}>
            Enable Raid Gate
          </button>
          <button className="btn" onClick={() => void setRaidGate(false)}>
            Disable Raid Gate
          </button>
        </div>
      </section>

      <section className="panel grid" style={{ gap: 6 }}>
        <h3>Utilities and Command Controls</h3>
        <p className="muted">Use slider controls to enable or disable individual commands for this server.</p>
        {commandStates.map((entry) => (
          <div className="toggle-row" key={entry.command_name}>
            <div className="toggle-meta">
              <strong>{entry.command_name}</strong>
              <span className="muted">Updated {formatTimestamp(entry.updated_at)}</span>
            </div>
            <div className="toggle-control">
              <span className={`pill ${entry.enabled ? "status-on" : "status-off"}`}>
                {entry.enabled ? "enabled" : "disabled"}
              </span>
              <label className="switch" aria-label={`toggle ${entry.command_name}`}>
                <input
                  type="checkbox"
                  checked={entry.enabled}
                  onChange={(event) => void toggleCommand(entry.command_name, event.target.checked)}
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
