# Xena Dashboard TS

Standalone Next.js dashboard product for managing Fluxer bot operations across shared guilds.

## Why PostgreSQL (Production Default)

For production deployments, PostgreSQL is the default for operational reliability and easier managed-host scaling. SQLite remains available for local development and single-node setups.

## Core Features

- Fluxer OAuth login
- Shared guild discovery (user guilds intersected with bot guilds)
- Guild control panel for:
  - channel restrictions
  - raid gate controls
  - warning visibility
  - command enable and disable toggles
  - editable welcome and level-up templates
- TOTP-gated protected writes with re-authorization window
- TOTP setup with bot DM delivery and fallback secret output
- White-label branding via `DASHBOARD_BRAND_NAME`

## Local Development

1. Copy `.env.example` to `.env`.
2. Fill OAuth and bot settings.
3. Install dependencies:

```bash
npm install
```

4. Run dev server:

```bash
npm run dev
```

5. Open `http://localhost:3000`.

## Production Database (Current Default)

Set:

- `DASHBOARD_DB_DRIVER=postgres`
- `POSTGRES_HOST`
- `POSTGRES_PORT`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DATABASE`
- `DASHBOARD_SESSION_SECRET` (use a random value with at least 32 characters)

The dashboard auto-creates required tables on first startup.

## Optional SQLite Mode

For local/single-node use:

- `DASHBOARD_DB_DRIVER=sqlite`
- `BOT_DB_PATH=../bot_js/data/warnings.db`

## Deploying as a Sellable Product

- Container deploy: use `Dockerfile` and `docker-compose.yml` in this folder.
- White-label branding: set `DASHBOARD_BRAND_NAME`.
- Use persistent storage and backups for PostgreSQL.
- For managed PostgreSQL, enforce TLS (`POSTGRES_SSL_MODE=required`).
- Keep OAuth redirect URL aligned with your public dashboard domain.
- Do not deploy with localhost callback URLs or placeholder secrets.
- `docker-compose.yml` defaults to PostgreSQL service + dashboard.

See `COMMERCIALIZATION.md` for productization checklist.
