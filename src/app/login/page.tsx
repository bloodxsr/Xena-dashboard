import Link from "next/link";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { sanitizeNextPath } from "@/lib/next-path";

type LoginPageProps = {
  searchParams?: {
    next?: string | string[];
    error?: string | string[];
  };
};

function readSingle(value: string | string[] | undefined): string | null {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && value.length > 0) {
    return value[0];
  }
  return null;
}

function errorMessageFromCode(code: string | null): string | null {
  switch ((code ?? "").trim()) {
    case "key_required":
      return "A dashboard key is required to sign in.";
    case "key_invalid":
      return "The dashboard key is incorrect.";
    case "oauth_state_mismatch":
      return "Sign-in session expired. Please start login again.";
    case "oauth_denied":
      return "Fluxer authorization was cancelled.";
    case "oauth_disabled":
      return "OAuth login is disabled in Fluxer-only mode.";
    case "oauth_config_missing":
      return "Fluxer OAuth client settings are missing. Configure FLUXER_CLIENT_ID and FLUXER_CLIENT_SECRET.";
    case "oauth_failed":
      return "OAuth login failed. Please try again.";
    default:
      return null;
  }
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  const session = getSession();
  if (session) {
    redirect("/dashboard");
  }

  const env = getEnv();
  const nextPath = sanitizeNextPath(readSingle(searchParams?.next));
  const errorMessage = errorMessageFromCode(readSingle(searchParams?.error));
  const oauthConfigured = Boolean(env.fluxerClientId && env.fluxerClientSecret);

  return (
    <>
      <section>
        <p className="section-label" style={{ marginBottom: "24px" }}>
          04 / Sign In
        </p>
        <h1 style={{ fontSize: "clamp(38px, 6vw, 72px)", lineHeight: 1, textTransform: "uppercase", marginBottom: "16px" }}>
          Secure Access
        </h1>
        <p className="muted" style={{ maxWidth: "620px" }}>
          Sign in to reach the staff console and manage guild security workflows.
        </p>
      </section>

      <section className="panel stack" style={{ maxWidth: "620px" }}>
        <div className="row" style={{ justifyContent: "space-between", gap: "16px" }}>
          <p className="mono">Auth Provider: FLUXER OAUTH2</p>
          <p className="mono" style={{ color: "var(--muted)" }}>
            Next: {nextPath}
          </p>
        </div>

        {errorMessage ? <div className="alert error">{errorMessage}</div> : null}

        <form method="get" action="/api/auth/login" className="stack">
          <input type="hidden" name="next" value={nextPath} />

          {env.fluxerDashboardKey ? (
            <label className="field">
              <span>Dashboard Key</span>
              <input
                className="input"
                name="key"
                type="password"
                autoComplete="off"
                placeholder="Enter dashboard key"
                required
              />
            </label>
          ) : (
            <div className="alert info">
              Fluxer OAuth login is enabled. You will be redirected to Fluxer authorization.
            </div>
          )}

          <div className="alert info">Requested scope: {env.fluxerOauthScope}</div>

          {!oauthConfigured ? (
            <div className="alert error">
              Missing OAuth config. Add FLUXER_CLIENT_ID and FLUXER_CLIENT_SECRET to your environment.
            </div>
          ) : null}

          <div className="row">
            <button className="btn" type="submit" disabled={!oauthConfigured}>
              Connect With Fluxer
            </button>
            <Link className="btn alt" href="/">
              Back Home
            </Link>
          </div>
        </form>
      </section>
    </>
  );
}
