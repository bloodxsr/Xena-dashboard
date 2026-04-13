# Commercialization Checklist

This dashboard is now decoupled from `bot_js` and can be sold as a standalone web product.

## Product Readiness

- Keep dashboard source in top-level `web_dashboard_ts` only.
- Use PostgreSQL in production (`DASHBOARD_DB_DRIVER=postgres`).
- Use a dedicated `DASHBOARD_SESSION_SECRET` per deployment.
- Set `DASHBOARD_BRAND_NAME` for white-label offerings.

## Multi-Tenant and Sales Model

- Tenant boundary is per guild; each customer manages only their authorized guilds.
- Consider one of these pricing models:
  - per guild managed
  - per monthly active moderators
  - flat tier with feature limits
- Keep billing and subscription enforcement outside this codebase (API gateway or SaaS control plane).

## Security Baseline

- Enforce HTTPS in front of the app.
- Store OAuth secrets in a secret manager, not in repo files.
- Use `POSTGRES_SSL_MODE=required` for managed DB services.
- Rotate dashboard session secret periodically.
- Keep TOTP required for protected writes.

## Operations

- Add uptime and error monitoring.
- Add backups and restore drills for PostgreSQL.
- Add rate limiting/WAF at edge.
- Version your product and publish changelogs.