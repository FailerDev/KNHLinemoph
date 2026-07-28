# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

```powershell
npm run dev          # dev server + HMR at http://localhost:3333
npm run build        # compile TS → build/ (required before npm start)
npm start            # production server
npm run typecheck    # tsc --noEmit
npm run cron:run     # run cron pipeline once manually
node ace list        # list all ace commands
node ace test                          # run all tests
node ace test --suite=unit             # unit tests only
node ace test --suite=functional       # functional tests only
```

First-time setup:
```powershell
npm install
copy .env.example .env   # then fill in APP_DB_* + HIS_DB_* + CRON_TOKEN
node ace generate:key    # if APP_KEY is empty
```

## Architecture

AdonisJS v6 (TypeScript, ESM) rewrite of a PHP LINE notification system. Runs on the existing PHP MySQL schema — **migrations in `database/migrations/` are documentation only; never run `node ace migration:run`**.

### Dual-database pattern

Two completely separate MySQL connections:

- **APP DB** (`DB_*` env vars) — Lucid ORM, connection defined in `config/database.ts`. Stores users, schedules, templates, groups, logs, settings.
- **HIS DB** — raw `mysql2` connection pools managed by `app/services/his_manager.ts`. Multiple named pools (one per logical HIS name). Config comes from the `his_databases` table (UI-managed); falls back to `HIS_DB_*` env vars. Pool is lazily rebuilt when a row signature changes. HIS charset is typically `tis620`.

Never use Lucid to touch HIS data. Always go through `HisManager.queryFirst()` / `HisManager.query()`.

### Cron pipeline

`app/services/cron_service.ts` is the core — an 8-step pipeline:
0. Deactivate expired `specific`-mode schedules
1. Reset `repeat` schedules whose `next_send_time` is stale
2. Initialise `next_send_time` for new repeat schedules
3+4. Find and process due schedules (calls `NotificationService.sendNotification`)
5. Catch missed repeat windows
6. Clean old logs (DB rows + `logs/cron_*.log` files > 7 days)
7. Performance stats
8. Daily SQL backup at hour 23 → `backups/auto_backup_YYYY-MM-DD.sql` (keeps last 30)

The pipeline has an in-process mutex (`isRunning`) — concurrent HTTP and tick calls skip instead of overlap.

Three triggers for the same `CronService.runOnce()`:
- `SchedulerProvider` (in-process `node-cron`, every minute, only in `web` env)
- `node ace cron:run` CLI
- `POST /cron/run?token=CRON_TOKEN` (CSRF-exempt, auth-exempt — verified by token in controller)

### Notification flow

`NotificationService.sendNotification(scheduleId, force)`:
1. Load schedule → load template → extract `{variable}` placeholders from `template.variables`
2. For each variable, find a matching `notification_items` row and run its SQL against HIS via `HisManager`
3. Build message: substitute system placeholders (`{date}`, `{date_th}`, `{weekday}`, `{org_name}`, etc.) then item data placeholders
4. Send to each `line_groups` row in `schedule.group_ids` via `LineApiService.sendMessage`
5. Write one `notification_logs` row per send attempt

`force=true` skips all day/time gates (used by test-send from UI).

### Role system

Three roles with numeric rank: `viewer(1) < operator(2) < admin(3)`. Enforced by `RoleMiddleware` — must run after `auth` middleware. JSON/non-GET requests get 403 JSON; GET requests flash and redirect to dashboard. Route groupings in `start/routes.ts` show which role each section requires.

### Auth

Session guard (`@adonisjs/session`). Passwords are PHP `$2y$` bcrypt hashes — `bcryptjs` reads them natively; no rehash needed. Default users: `admin` (ID 1), `knh` (ID 2).

### Views

Edge.js server-rendered. Layout `resources/views/layouts/app.edge` wraps all authenticated pages. `ShareViewGlobalsMiddleware` injects `currentUser`, `currentPage`, `flashMessages`, and `systemSettings` into every view so partials can access them without explicit passing.

### ENV variables

All validated at startup in `start/env.ts` using Adonis `Env.schema` — the app will refuse to start if required vars are missing. Key vars: `CRON_TOKEN`, `MAX_LOG_DAYS`, `DEFAULT_MOPH_API_URL`, `LINE_API_TIMEOUT`.

## Deployment (Linux + PM2)

Production server runs on Linux. Build on Windows, then copy `build/` to server.

```bash
# Build (Windows)
npm run build

# First-time start on Linux (run from inside build/)
cd /home/project/linemoph/build
pm2 start bin/server.js --name KNHLinemoph

# After uploading new build/ — restart
pm2 restart KNHLinemoph

# View logs
pm2 logs KNHLinemoph
```

**Important:** Always `npm run build` before copying to server after any code change. PM2 keeps the cron running even when browser is closed — no browser needed for notifications to send.

### CDCU notes

- Checks every 1 minute (same tick as main cron via `CronService`)
- No time-window gate — fires whenever condition matches (any time of day)
- Deduplication: `cdcu_sent_logs` prevents re-sending same VN+ICD10 combo within the same day
