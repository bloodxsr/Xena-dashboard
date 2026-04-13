# Fluxer Dashboard TS

Standalone Next.js dashboard product for managing Fluxer bot operations across shared guilds.

## Why PostgreSQL

For a sellable dashboard, PostgreSQL is the best fit here because it gives you reliable concurrent writes, safe schema evolution, backups/replicas, and managed-hosting compatibility. SQLite is still supported for local development.

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

## Production Database (Recommended)

Set:

- `DASHBOARD_DB_DRIVER=postgres`
- `DASHBOARD_SESSION_SECRET` (use a random value with at least 32 characters)
- `POSTGRES_HOST`
- `POSTGRES_PORT`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DATABASE`

The dashboard auto-creates required tables on first startup.

## SQLite Fallback

For local-only setups:

- `DASHBOARD_DB_DRIVER=sqlite`
- `BOT_DB_PATH=../bot_js/data/warnings.db`

See `COMMERCIALIZATION.md` for productization checklist.
