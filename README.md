# Fluxer Web Dashboard (TypeScript)

This module is a staff-focused control surface for the Fluxer moderation bot.

It runs as a Next.js App Router application and uses the same SQLite database as the bot (`bot/warnings.db` by default). The dashboard is not a demo panel: it executes live moderation, role, purge, and verification actions through Fluxer API endpoints using your bot token.

## Core Responsibilities

- Fluxer OAuth2 login and callback handling.
- Signed session and OAuth state management.
- Staff-only guild listing based on:
	- OAuth guild scope
	- shared bot guild membership
	- permission checks
	- optional guild allowlist
- Guild console for:
	- security config updates
	- raid gate toggles
	- member moderation actions
	- role add/remove operations
	- warning counter operations
	- purge operations with bulk + fallback behavior
	- blacklist editing
	- pending verification queue approvals/rejections
	- moderation log and join-event visibility
	- server profile card metadata overrides

## Stack

- Next.js 14 (App Router)
- TypeScript
- React 18
- `better-sqlite3`
- Fluxer OAuth2 and bot API calls

## Project Layout

```text
web_dashboard_ts/
	.env.example
	.gitignore
	next.config.mjs
	package.json
	src/
		app/
			login/
			oauth/callback/
			dashboard/
			guild/[guildId]/
			verify/[guildId]/
			api/
				auth/login/
				guild/[guildId]/...
		components/
			GuildConsole.tsx
		lib/
			auth.ts
			db.ts
			env.ts
			fluxer.ts
			oauth-state.ts
			permissions.ts
			session.ts
			snowflake.ts
			words.ts
```

## Authentication And Session Flow

1. User opens `/login`.
2. `GET /api/auth/login` validates optional dashboard key and creates signed OAuth state.
3. Route sets short-lived cookies (`fx_oauth_state`, `fx_oauth_next`) and redirects to Fluxer authorize URL.
4. Fluxer redirects back to `/oauth/callback` with `code` and `state`.
5. Callback validates state (cookie match or signed token parse fallback).
6. Code is exchanged for access token.
7. Signed session cookie `fx_dash_session` is issued (8-hour max age).
8. User is redirected to the sanitized `next` path.

## Runtime Route Map

### Pages

- `/` home page.
- `/login` sign-in and error handling surface.
- `/oauth/callback` OAuth completion endpoint.
- `/dashboard` manageable guild list.
- `/guild/<guild_id>` full guild operations console.
- `/verify/<guild_id>` end-user verification completion page.
- `/logout` session clear endpoint.

### API Endpoints

- `GET|POST /api/auth/login`
	- starts OAuth flow
	- enforces optional dashboard key
	- normalizes origin to `APP_BASE_URL`

- `GET /api/guild/<guild_id>/config`
	- returns persisted guild security config

- `POST /api/guild/<guild_id>/config`
	- updates config keys such as
		- `verification_url`
		- `raid_detection_enabled`
		- `raid_gate_threshold`
		- `raid_monitor_window_seconds`
		- `raid_join_rate_threshold`
		- `gate_duration_seconds`
		- `join_gate_mode`

- `GET|POST /api/guild/<guild_id>/profile`
	- read/update dashboard card metadata (`display_name`, `icon_url`)

- `GET /api/guild/<guild_id>/roles`
	- fetches live guild roles from Fluxer bot API

- `POST /api/guild/<guild_id>/member-actions`
	- actions: `kick`, `ban`, `unban`, `mute`, `unmute`, `add_role`, `remove_role`
	- validates Snowflake IDs and logs moderation events to SQLite

- `POST /api/guild/<guild_id>/purge`
	- lists recent channel messages
	- attempts bulk delete first
	- falls back to individual deletes when needed

- `POST /api/guild/<guild_id>/raidgate`
	- toggles gate active/inactive with optional duration

- `GET /api/guild/<guild_id>/pending`
	- returns pending verification queue

- `POST /api/guild/<guild_id>/verifications/<user_id>`
	- `approve`: marks verified and attempts timeout clear
	- `reject`: marks rejected and attempts kick

- `GET /api/guild/<guild_id>/warnings`
	- returns warning table rows

- `GET|POST /api/guild/<guild_id>/warnings/<user_id>`
	- read warning count
	- mutate with `set`, `increment`, `reset`

- `GET /api/guild/<guild_id>/moderation-logs`
	- returns latest moderation actions

- `GET /api/guild/<guild_id>/join-events`
	- returns join telemetry records

- `GET|POST /api/guild/<guild_id>/blacklist`
	- list words
	- add/remove a word
	- replace full list

All guild routes require a valid session and successful `assertStaffGuildAccess` check.

## Environment Variables

Copy `.env.example` to `.env` and set required values.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `APP_BASE_URL` | yes | `http://127.0.0.1:3000` | Canonical app origin for redirects and callback URI derivation. |
| `FLUXER_WEB_BASE` | yes | `https://web.fluxer.app` | OAuth authorize base URL. |
| `FLUXER_API_BASE` | yes | `https://api.fluxer.app` | Fluxer API base URL. |
| `FLUXER_REDIRECT_URI` | no | derived | Explicit callback URI override if needed by OAuth app registration. |
| `FLUXER_CLIENT_ID` | yes | none | OAuth client id. |
| `FLUXER_CLIENT_SECRET` | yes | none | OAuth client secret. |
| `FLUXER_OAUTH_SCOPE` | no | `identify guilds` | OAuth scope string. |
| `SESSION_SECRET` | strongly yes | dev fallback | HMAC key for state/session signatures. |
| `DATABASE_PATH` | no | `../bot/warnings.db` | SQLite path. |
| `FLUXER_BOT_TOKEN` | yes for live ops | none | Required for bot guild intersection and all live guild control calls. |
| `BOT_TOKEN` | fallback | none | Alternate bot token name. |
| `FLUXER_DASHBOARD_KEY` | no | none | Optional shared key required on `/login`. |
| `FLUXER_ALLOWED_GUILD_IDS` | no | empty | Comma-separated guild whitelist. |

## Local Development

From repository root:

```powershell
cd web_dashboard_ts
npm install
npm run dev
```

Scripts in `package.json`:

- `npm run dev` start development server.
- `npm run build` production build.
- `npm run start` run built app.
- `npm run typecheck` TypeScript validation without emit.

## Integration With Bot Verification Workflow

Set bot verification URL to this dashboard route format:

`http://127.0.0.1:3000/verify/<guild_id>`

Example bot command:

`/setverificationurl http://127.0.0.1:3000/verify/123456789012345678`

## Data Ownership And Cross-Service Behavior

- Bot owns core schema initialization and moderation/security writes.
- Dashboard reads and updates shared tables through `src/lib/db.ts`.
- Dashboard also stores `guild_profiles` table for card metadata.
- Blacklist edits are persisted into `bot/words.py` through `src/lib/words.ts`.

## Reliability And Safety Notes

- Snowflake IDs are treated as strings in route-level parsing and Fluxer API clients.
- Role and moderation actions return explicit HTTP errors when token, auth, or IDs are invalid.
- Purge action is intentionally defensive (bulk then fallback single-delete).
- Guild access is re-validated on each API request.

## Troubleshooting

### OAuth state mismatch

- Restart login from `/login`.
- Ensure browser host matches `APP_BASE_URL` origin.
- Keep `next.config.mjs` `allowedDevOrigins` aligned for `localhost` and `127.0.0.1`.

### Roles endpoint returns 502

- Verify `FLUXER_BOT_TOKEN` is set.
- Verify bot is in the requested guild.
- Verify `guild_id` is exact Snowflake string (no numeric rounding).

### Login page says OAuth config missing

- Set both `FLUXER_CLIENT_ID` and `FLUXER_CLIENT_SECRET`.

### Dashboard shows no guilds

- Ensure OAuth scope includes `guilds`.
- Ensure bot and user share guilds.
- Ensure user has staff permissions in those guilds.
- Check `FLUXER_ALLOWED_GUILD_IDS` is not excluding your guild.
