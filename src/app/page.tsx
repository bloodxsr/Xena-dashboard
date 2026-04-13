import Link from "next/link";

export default function LandingPage() {
  return (
    <main>
      <section className="hero">
        <div className="grid" style={{ gap: 18 }}>
          <span className="pill">Fluxer Bot Dashboard</span>
          <h1>Minimal control panel for moderation, security, and leveling.</h1>
          <p>
            Connect your Fluxer account, pick a shared server, and control raid gate, warning visibility,
            channel restrictions, utility actions, command enablement, and editable message templates in one place.
          </p>
          <div className="nav-actions">
            <a href="/api/auth/login" className="btn primary">
              Login with Fluxer
            </a>
            <Link href="/dashboard" className="btn">
              Open Dashboard
            </Link>
          </div>
        </div>

        <div className="kpi">
          <article className="panel">
            <h3>Secure Writes</h3>
            <p className="muted">Every high-impact change is TOTP-gated with a 30-day authorization window.</p>
          </article>
          <article className="panel">
            <h3>Command Policy</h3>
            <p className="muted">Enable or disable commands per server, including purge and utility workflows.</p>
          </article>
          <article className="panel">
            <h3>Template Control</h3>
            <p className="muted">Edit welcome and level-up messages using placeholders like {"{user.mention}"}.</p>
          </article>
          <article className="panel">
            <h3>Raid Visibility</h3>
            <p className="muted">Inspect warnings and trigger raid gate actions from a single server panel.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
