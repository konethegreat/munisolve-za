# Dependency maintenance

On October 3, 2026, the server audit reported 17 findings (13 high, two moderate,
two low) and the client audit reported 17 (12 high, three moderate, two low).
Refreshing the committed lockfiles and making the changes below reduced both
full dependency audits to zero findings.

## Changes that need context

- Node.js 22.12 or later is declared in both manifests, matching the documented
  runtime and the Node 22 CI jobs.
- `npm run dev` in the server uses `node --watch src/server.js`. Removing nodemon
  removes its chokidar/braces dependency chain. The [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
  lists no patched version. [Node watch mode](https://nodejs.org/api/cli.html#--watch)
  restarts the process when the entry point or imported modules change; restart
  manually after editing environment variables or the Prisma schema.
- Prisma CLI and client remain on version 6, with a minimum of 6.19.3. The
  application continues to use its existing Prisma client and `prisma db push`.
- A scoped npm override selects `deepmerge-ts` 8.0.2 only under `@prisma/config`.
  Prisma's config package still pins vulnerable 7.1.5; the [upstream issue](https://github.com/prisma/orm/issues/30052)
  tracks replacing that dependency. The override does not select a new Prisma
  major version. Remove it when the selected Prisma 6 release uses a patched
  dependency, then repeat generation and the PostgreSQL workflow checks.
- Unused `@prisma/adapter-pg`, `pg` and native `bcrypt` dependencies were removed.
  The server uses Prisma 6's built-in PostgreSQL engine and `bcryptjs`; there are
  no imports of those removed packages in the application, seeds or tests.
- Other dependencies were refreshed within the existing manifest version
  ranges. Both lockfiles are committed so `npm ci` reproduces the selection.
- The React Hooks lint plugin stays at the existing 7.0.1 release, now pinned.
  Its 7.1.1 update adds diagnostics on existing effect patterns in six components;
  that component refactor is separate from this dependency security change.
  The existing lint rules remain enabled, and the refreshed dependency tree for
  7.0.1 has no npm audit findings. ESLint 9 remains in use and emits an upstream
  end-of-support warning; an ESLint 10 migration is a subsequent tooling task.

## Recorded local checks

The refresh was checked on Windows with Node.js 26.8.1. CI uses Node.js 22.

| Check | Result |
|---|---|
| Clean installs and Prisma client generation | Passed |
| Server and client npm audits, including development dependencies | Zero findings |
| Existing API tests | 75 passed |
| Disposable PostgreSQL HTTP workflow | All 34 steps passed |
| Prisma config loading with the scoped override | Passed |
| Server watch startup, source-change restart and health responses | Passed |
| Client lint and production build | Passed |
| Manual browser check | Login, synthetic submission, detail timeline, admin closure and users table passed |

The client build still warns about its main bundle exceeding 500 kB. The Hooks
lint refactor, ESLint support migration and bundle splitting are recorded as
follow-up work rather than silently relaxing the existing checks.

## Reproduce validation

From the repository root, with Node.js 22.12+ and Docker running:

```sh
npm --prefix server ci
npm --prefix client ci
npm --prefix server audit --audit-level=low
npm --prefix client audit --audit-level=low
npm --prefix server test
npm --prefix server run demo:verify
npm --prefix client run lint
npm --prefix client run build
```

The dependency gates include development dependencies and fail on advisories of
any severity. The workflow verifier creates and removes a fresh PostgreSQL
container, so it does not require a developer database or provider credentials.
It exercises schema push, seeding, password authentication, report permissions,
the five report lifecycle states and activity history through the real API.

These checks cover the installed dependency tree and the synthetic workflow.
They do not prove the hosted deployment, live provider integrations or the
absence of vulnerabilities beyond the npm advisory database.
