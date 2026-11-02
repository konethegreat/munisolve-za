# Operations runbook

Deployment, rollback, backup and incident guidance for the hosted MuniSolve ZA
demo. Everything here is designed for the R0 free tiers: Render for the API,
Vercel for the React SPA, Neon for PostgreSQL and GitHub Actions for scheduled
work. Secrets live only in the Render dashboard and the local untracked
`C:\Users\Konet\.qoder\secrets\render.env` file; never commit them.

## 1. The moving parts

| Piece | Where | What to check |
|---|---|---|
| API | Render web service `munisolve-za-1`, `https://munisolve-za-1.onrender.com` | `/health` (DB-free liveness), `/ready` (database + migrations) |
| SPA | Vercel project `munisolve-za`, `https://munisolve-za.vercel.app` | login page, `/api` proxy through `vercel.json` |
| Database | Neon PostgreSQL | `/ready` reports `database: "up"`, `migrations: "current"` |
| SLA / outbox / webhooks | `.github/workflows/sla-tick.yml`, hourly at `:05` | `POST /api/internal/tick` returns `enqueued`, `sent`, `failed`, `decisions` |
| Keep-alive | `.github/workflows/keep-api-awake.yml`, every 10 minutes | `/health` returns 200 |

The API is deployed from `render.yaml` with `autoDeploy: false`, so merging to
`main` does not publish it by itself. Vercel deploys the client from `main`
automatically.

## 2. Deploy

1. Merge the PR to `main` and wait for `Application checks` to pass.
2. Render dashboard -> the API service -> **Manual Deploy** -> **Deploy latest
   commit** (or use the Render API from the machine that holds the API key).
3. Watch the deploy log. The start command is
   `npx prisma migrate deploy && node dist/server.js`, so migrations run before
   the process starts. A failed migration leaves the previous instance serving.
4. Verify, with the public origin:

   ```sh
   curl -fsS https://munisolve-za-1.onrender.com/health
   curl -fsS https://munisolve-za-1.onrender.com/ready
   curl -fsS https://munisolve-za-1.onrender.com/api/public/stats
   curl -fsSI https://munisolve-za.vercel.app | head -n 1
   ```

   `/ready` should be 200 with `database: "up"` and `migrations: "current"`.
   The first request after Neon auto-suspend can take a few seconds; retry.
5. Open the Vercel production URL and check the landing stats, login and one
   report in each role. The browser walkthrough is not automated by CI.
6. Dispatch `Keep API awake` and `SLA tick` once from the Actions tab to confirm
   both repository secrets still work.

## 3. Rollback

Application rollback is safe; schema rollback is not automatic.

- **Render:** service -> **Events** / **Deploys** -> open the last known-good
  deploy -> **Redeploy**. This restores the previous image and code.
- **Vercel:** project -> **Deployments** -> previous successful deployment ->
  **Promote to Production**.
- **Bad migration:** migrations are immutable and forward-only. Do not edit or
  delete an applied migration. Write a new corrective migration, test it with
  `npm run demo:verify`, and deploy. If the database itself is damaged, restore
  a dump (section 4) or a Neon branch, then redeploy.
- **Bad release commit:** `git revert <sha>` on a branch, open a PR and merge it;
  never force-push `main`.

## 4. Backup and restore (Neon free plan)

The free plan does not include long-term scheduled backups. Take an on-demand
logical backup before risky migrations and at least weekly. Use the direct
(non-pooled) connection string and keep the dump off the repository:

```sh
# In a shell where DIRECT_URL is exported from your secret store.
pg_dump "$DIRECT_URL" --format=custom --no-owner --no-privileges \
  --file="munisolve-$(date +%F).dump"
```

Restore rehearsal, into a new Neon branch/database rather than over production:

```sh
pg_restore --no-owner --no-privileges --dbname="$RESTORE_URL" munisolve-2026-11-02.dump
DIRECT_URL="$RESTORE_URL" DATABASE_URL="$RESTORE_URL" npx prisma migrate status
```

Point a staging instance at the restored copy and confirm `/ready` before
switching production traffic. Neon's own branch and restore features can be
used instead of `pg_dump`; confirm the retention window shown in the Neon
console for the current plan before relying on it.

## 5. Scheduled jobs and free-tier budgets

- **Keep-alive** pings `/health` every 10 minutes. Render sleeps a free service
  after 15 idle minutes, and 750 free instance hours per month cover one warm
  service (about 730 hours). If the monthly budget gets tight, widen the cron to
  `*/15` or disable the workflow; the service then cold-starts on demand.
- `/health` never queries PostgreSQL, so keep-alive does not wake Neon compute.
- **SLA tick** runs hourly and wakes Neon briefly. Do not move it to every five
  minutes; that would keep free Neon compute awake all month.
- GitHub disables scheduled workflows after 60 days without repository activity.
  Dispatch each workflow manually after a long quiet period.
- Required repository secrets: `MUNISOLVE_API_URL` and `TICK_SECRET`. The tick
  workflow fails loudly if either is missing.

## 6. Observability and error capture

- The API logs Pino JSON lines. Each request carries an `X-Request-Id` (accepted
  from the caller or generated) and every error response includes the same
  `requestId`; quote it when searching the Render log stream.
- `/health` is liveness only. `/ready` checks the database and migration state
  and returns 503 while either is unavailable.
- Sentry is deliberately not wired in on the free plan: it would add an account,
  an SDK and a DSN to a portfolio deployment whose budget is R0. The structured
  logs, request IDs, health probes and GitHub Actions history cover the demo's
  needs. When a budget exists, add Sentry server-side only, with a low
  `tracesSampleRate` and PII disabled.

## 7. Common incidents

| Symptom | Likely cause | Action |
|---|---|---|
| `POST /api/internal/tick` returns 401 | `TICK_SECRET` differs between GitHub and Render | Re-copy the secret in both places |
| Tick returns `sent: 0, failed: N` | Resend key or verified sender domain is missing/invalid | Check `RESEND_API_KEY` and `RESEND_FROM_EMAIL`; inspect `NotificationOutbox.lastError`, which now carries the provider status and message. A `@resend.dev` sender is Resend's sandbox and only delivers to the Resend account owner's address; verify `munisolve.co.za` in Resend and set `RESEND_FROM_EMAIL` to that domain before real recipients are expected. Rows with no email config are marked `SKIPPED`, not retried |
| AI chat returns 503 `AI_UNAVAILABLE` | No/invalid `ANTHROPIC_API_KEY` or provider outage | Reports still work; restore the key or wait |
| `/ready` is 503 while `/health` is 200 | Neon suspended, waking, or migration drift | Retry; then check the Neon console and `prisma migrate status` |
| Login or register returns 429 | Auth rate limit (5 attempts / 15 min / IP) | Wait, or clear the limit by restarting the instance; do not raise limits for convenience |
| Webhook deliveries fail repeatedly | Receiver down, non-2xx, or URL resolves to a private address | Check `GET /api/admin/webhooks/:id/deliveries`; 429/5xx retry, other 4xx and private targets fail permanently |
| Vercel page loads but API calls fail | `MUNISOLVE_API_URL` moved or the API is cold | Check `vercel.json` rewrite target and `/health` |
| Vercel build fails on lint | Client lint is part of CI | Run `npm --prefix client run lint` locally and fix before merging |

## 8. Routine maintenance

- Monthly: `npm audit --audit-level=low` in `server/` and `client/`, refresh
  lockfiles deliberately, and re-run `npm run demo:verify` plus the client
  build. Known dependency notes live in `docs/DEPENDENCIES.md`.
- After any schema change: add a migration, run `npm run demo:verify`, then
  deploy. Never edit an applied migration and never use `db push` against a
  database whose history matters.
- Quarterly: rehearse a restore from a fresh dump, rotate `TICK_SECRET`,
  `JWT_SECRET` and webhook secrets, and review who has Render/Vercel/Neon
  access.
