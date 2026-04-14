"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type SessionPayload = {
  authenticated: boolean;
  user?: {
    id: string;
    username: string;
    avatarUrl: string | null;
  };
  guilds?: Array<{
    id: string;
    name: string;
    iconUrl: string | null;
  }>;
  error?: string;
};

function initials(name: string): string {
  const text = String(name || "").trim();
  if (!text) {
    return "U";
  }

  const parts = text
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  return parts.map((part) => part[0]?.toUpperCase() || "").join("") || "U";
}

export function DashboardHomeClient() {
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<SessionPayload>({ authenticated: false });

  useEffect(() => {
    let active = true;

    const run = async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/session", { cache: "no-store" });
        const data = (await response.json()) as SessionPayload;
        if (active) {
          setPayload(data);
        }
      } catch (error) {
        if (active) {
          setPayload({ authenticated: false, error: String(error) });
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    run();
    return () => {
      active = false;
    };
  }, []);

  const guilds = useMemo(() => payload.guilds || [], [payload.guilds]);

  if (loading) {
    return <div className="panel">Loading dashboard session...</div>;
  }

  if (!payload.authenticated) {
    return (
      <section className="panel dashboard-login-panel">
        <h2>Login required</h2>
        <p className="muted">Connect with Fluxer to view and manage servers shared with your bot.</p>
        {payload.error ? <p className="muted">Auth status: {payload.error}</p> : null}
        <div className="nav-actions">
          <a href="/api/auth/login" className="btn primary">
            Login with Fluxer
          </a>
        </div>
      </section>
    );
  }

  const userName = payload.user?.username || "Operator";

  return (
    <div className="grid" style={{ gap: 16 }}>
      <section className="panel dashboard-hero-panel">
        <div className="dashboard-user-wrap">
          {payload.user?.avatarUrl ? (
            <img src={payload.user.avatarUrl} alt={userName} className="dashboard-user-avatar" />
          ) : (
            <span className="dashboard-user-avatar dashboard-user-avatar-fallback">{initials(userName)}</span>
          )}
          <div className="grid" style={{ gap: 6 }}>
            <h2 style={{ margin: 0 }}>{userName}</h2>
            <p className="muted" style={{ margin: 0 }}>
              Select a server to configure moderation, security, levels, welcome flow, and tickets.
            </p>
            <span className="pill">{guilds.length} shared server(s)</span>
          </div>
        </div>
      </section>

      <section className="guild-grid">
        {guilds.map((guild) => (
          <article key={guild.id} className="panel guild-card">
            <div className="guild-card-header">
              {guild.iconUrl ? (
                <img src={guild.iconUrl} alt={guild.name} className="guild-icon" />
              ) : (
                <span className="guild-icon guild-icon-fallback">{initials(guild.name)}</span>
              )}
              <div className="grid" style={{ gap: 4 }}>
                <h3>{guild.name}</h3>
                <p className="muted guild-id">ID: {guild.id}</p>
              </div>
            </div>

            <div className="guild-card-actions">
              <Link href={`/guild/${guild.id}`} className="btn primary">
                Open Server
              </Link>
            </div>
          </article>
        ))}

        {guilds.length === 0 ? (
          <article className="panel guild-card">
            <h3>No shared servers found</h3>
            <p className="muted">The bot and your account must both be in a server with manage permission.</p>
          </article>
        ) : null}
      </section>
    </div>
  );
}
