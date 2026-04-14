"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

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
};

function initials(name: string): string {
  const trimmed = String(name || "").trim();
  if (!trimmed) {
    return "U";
  }

  const parts = trimmed
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  return parts.map((part) => part[0]?.toUpperCase() || "").join("") || "U";
}

export function TopNavClient({ brandName }: { brandName: string }) {
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionPayload>({ authenticated: false });
  const [profileOpen, setProfileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;

    const run = async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/session", {
          cache: "no-store",
          credentials: "include"
        });
        const data = (await response.json()) as SessionPayload;
        if (active) {
          setSession(data);
        }
      } catch {
        if (active) {
          setSession({ authenticated: false });
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [pathname]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current) {
        return;
      }

      if (!menuRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, []);

  const guildCount = useMemo(() => (Array.isArray(session.guilds) ? session.guilds.length : 0), [session.guilds]);
  const userName = session.user?.username || "Operator";

  return (
    <header className="top-nav">
      <Link href="/" className="brand">
        {brandName}
      </Link>

      <nav className="nav-actions">
        <Link href="/dashboard" className={`btn ${pathname?.startsWith("/dashboard") ? "nav-active" : ""}`}>
          Dashboard
        </Link>

        {loading ? (
          <span className="btn">Loading...</span>
        ) : session.authenticated ? (
          <div className="profile-menu" ref={menuRef}>
            <button
              type="button"
              className={`profile-trigger ${profileOpen ? "is-open" : ""}`}
              onClick={() => setProfileOpen((prev) => !prev)}
            >
              {session.user?.avatarUrl ? (
                <img src={session.user.avatarUrl} alt={userName} className="profile-avatar" />
              ) : (
                <span className="profile-avatar profile-avatar-fallback">{initials(userName)}</span>
              )}
              <span className="profile-name">{userName}</span>
              <span className="profile-caret">▾</span>
            </button>

            {profileOpen ? (
              <div className="profile-dropdown">
                <div className="profile-meta">
                  <strong>{userName}</strong>
                  <span className="muted">{guildCount} shared server(s)</span>
                </div>
                <Link href="/dashboard" className="profile-item" onClick={() => setProfileOpen(false)}>
                  Open dashboard
                </Link>
                <a href="/api/logout" className="profile-item danger" onClick={() => setProfileOpen(false)}>
                  Logout
                </a>
              </div>
            ) : null}
          </div>
        ) : (
          <a href="/api/auth/login" className="btn primary">
            Connect Fluxer
          </a>
        )}
      </nav>
    </header>
  );
}
