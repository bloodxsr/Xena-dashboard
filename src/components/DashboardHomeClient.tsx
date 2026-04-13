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
      <div className="panel">
        <h2>Login required</h2>
        <p className="muted">Connect with Fluxer to view servers you and the bot share.</p>
        {payload.error ? <p className="muted">Auth status: {payload.error}</p> : null}
        <a href="/api/auth/login" className="btn primary">
          Login with Fluxer
        </a>
      </div>
    );
  }

  return (
    <div className="grid" style={{ gap: 16 }}>
      <section className="panel">
        <h2>{payload.user?.username || "Operator"}</h2>
        <p className="muted">Choose a server to manage bot behavior and security settings.</p>
        <div className="nav-actions">
          <a href="/api/logout" className="btn">
            Logout
          </a>
        </div>
      </section>

      <section className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12 }}>
        {guilds.map((guild) => (
          <article key={guild.id} className="panel">
            <h3>{guild.name}</h3>
            <p className="muted">ID: {guild.id}</p>
            <Link href={`/guild/${guild.id}`} className="btn primary">
              Open Server
            </Link>
          </article>
        ))}

        {guilds.length === 0 ? (
          <article className="panel">
            <h3>No shared servers found</h3>
            <p className="muted">The bot and your account must both be in a server with manage permission.</p>
          </article>
        ) : null}
      </section>
    </div>
  );
}
