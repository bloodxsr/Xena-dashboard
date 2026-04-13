"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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
        levelup_message_template: payload.config.levelup_message_template
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
        <h3>Channel Restrictions and Core Settings</h3>
        <div className="field-grid">
          {[
            "log_channel_id",
            "welcome_channel_id",
            "rules_channel_id",
            "chat_channel_id",
            "help_channel_id",
            "about_channel_id",
            "perks_channel_id",
            "leveling_channel_id"
          ].map((field) => (
            <label key={field}>
              {field}
              <input
                value={configDraft[field] || ""}
                onChange={(event) => setConfigDraft((prev) => ({ ...prev, [field]: event.target.value.trim() }))}
                placeholder="channel id or blank"
              />
            </label>
          ))}
        </div>

        <div className="field-grid">
          <label>
            verification_url
            <input
              value={configDraft.verification_url || ""}
              onChange={(event) => setConfigDraft((prev) => ({ ...prev, verification_url: event.target.value }))}
              placeholder="https://... or blank"
            />
          </label>
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
              onChange={(event) => setConfigDraft((prev) => ({ ...prev, gate_duration_seconds: event.target.value }))}
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

        <button className="btn primary" onClick={() => void saveConfig()}>
          Save Settings
        </button>
      </section>

      <section className="panel grid" style={{ gap: 10 }}>
        <h3>Editable Messages</h3>
        <p className="muted">You can use placeholders like {"{user.mention}"}, {"{guild.name}"}, {"{level}"}, {"{rank}"}.</p>
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
        <p className="muted">Enable or disable individual commands for this server.</p>
        {commandStates.map((entry) => (
          <div className="toggle-row" key={entry.command_name}>
            <span>{entry.command_name}</span>
            <label style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text)" }}>
              <input
                type="checkbox"
                checked={entry.enabled}
                onChange={(event) => void toggleCommand(entry.command_name, event.target.checked)}
              />
              {entry.enabled ? "enabled" : "disabled"}
            </label>
          </div>
        ))}
      </section>

      <section className="panel">
        <h3>Warning Counts</h3>
        <table className="table">
          <thead>
            <tr>
              <th>User</th>
              <th>Warnings</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {overview.warnings.map((warning) => (
              <tr key={warning.user_id}>
                <td>&lt;@{warning.user_id}&gt;</td>
                <td>{warning.warning_count}</td>
                <td>{warning.updated_at}</td>
              </tr>
            ))}
            {overview.warnings.length === 0 ? (
              <tr>
                <td colSpan={3} className="muted">
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
