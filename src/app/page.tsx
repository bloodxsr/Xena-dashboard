import Link from "next/link";

export default function LandingPage() {
  return (
    <main>
      <section className="hero hero-upgrade">
        <div className="grid" style={{ gap: 18 }}>
          <span className="pill">Fluxer Command Center</span>
          <h1>Manage moderation, tickets, level cards, and welcome flow in one control surface.</h1>
          <p>
            Build an experience that feels premium: tune command toggles, edit card templates, automate reaction-based
            tickets, and monitor warnings from a single dashboard.
          </p>
          <div className="nav-actions">
            <a href="/api/auth/login" className="btn primary">
              Connect Fluxer
            </a>
            <Link href="/dashboard" className="btn">
              Open Dashboard
            </Link>
          </div>
        </div>

        <div className="panel hero-preview-panel">
          <div className="hero-preview-banner">
            <div className="hero-preview-overlay">
              <h3>Welcome to your server</h3>
              <p>Customize title, subtitle, colors, and overlays in real time.</p>
            </div>
          </div>
          <div className="hero-preview-metrics">
            <span className="pill">Level Cards</span>
            <span className="pill">Reaction Tickets</span>
            <span className="pill">Raid Gate</span>
          </div>
        </div>
      </section>

      <section className="feature-grid">
        <article className="panel feature-card">
          <h3>Command Matrix</h3>
          <p className="muted">Enable or disable command families with clear slider controls and status chips.</p>
        </article>
        <article className="panel feature-card">
          <h3>Level Card Studio</h3>
          <p className="muted">Tune card colors, overlay intensity, and backgrounds to match your server identity.</p>
        </article>
        <article className="panel feature-card">
          <h3>Welcome Visuals</h3>
          <p className="muted">Create richer welcome moments with title and subtitle templates plus themed card output.</p>
        </article>
        <article className="panel feature-card">
          <h3>Reaction Tickets</h3>
          <p className="muted">Turn one reaction into a support ticket channel with role pings and starter context.</p>
        </article>
      </section>

      <section className="panel showcase-strip">
        <h3>Built for active communities</h3>
        <p className="muted">
          High-impact writes stay protected with TOTP, while your moderation and community workflows stay fast and
          visual.
        </p>
      </section>
    </main>
  );
}
