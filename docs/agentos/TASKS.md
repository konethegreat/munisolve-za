# MuniSolve ZA Working Plan: Tasks

## Phase 1: CI and Dependency Security Recovery
- [ ] Research the `picomatch` ReDoS advisory chain (`fdir` -> `tinyglobby` -> `vite`) in `client/` and document upgrade or override options in `docs/DEPENDENCIES.md`
- [ ] Resolve `client/` `npm audit --audit-level=low` failures (upgrade `vite` or apply a minimal lockfile/override fix) and verify `npm --prefix client run build` and `npm --prefix client test` pass

## Phase 2: Client Lint Modernization and Hooks Refactor
- [ ] Refactor synchronous `setState` in effects in `client/src/components/SiyandaChat.jsx` and `client/src/pages/Admin.jsx`
- [ ] Refactor synchronous `setState` in effects in `client/src/pages/ReportFault.jsx` and `client/src/pages/VerifyEmail.jsx`
- [ ] Fix function access before declaration diagnostics in `client/src/pages/Dashboard.jsx` and `client/src/pages/MapPage.jsx`
- [ ] Upgrade `eslint` and `@eslint/js` to a supported release, unpin `eslint-plugin-react-hooks` from `7.0.1`, update `docs/DEPENDENCIES.md`, and close issue #8

## Phase 3: Client Test Coverage and Frontend Hardening
- [ ] Add unit tests for `client/src/utils/mapUtils.js` and replace the em-dash fallback in `formatDate` with a standard hyphen
- [ ] Add unit tests for client API client helpers and auth/session storage utilities under `client/src/api/`
- [ ] Add unit tests for shared formatting, validation, or hook helpers under `client/src/utils/` and `client/src/hooks/`

## Phase 4: Performance Experiments and End-to-End Verification
- [ ] Measure `npm --prefix client run build` chunk sizes and experiment with `vite.config.js` `manualChunks` for heavy vendor libraries (Leaflet, Recharts)
- [ ] Run and verify `npm --prefix server run demo:verify` against disposable PostgreSQL and document results in `docs/agentos/REPORT.md`

## Phase 5: Documentation Audit and Release Review
- [ ] Audit `README.md`, `docs/DEPENDENCIES.md`, and `docs/OPERATIONS.md` against `.github/workflows/application-checks.yml` and package scripts, updating any stale commands or version notes
- [ ] Run a repository-wide review for constitution compliance (no em-dashes or en-dashes, clean `typecheck`, `lint`, `test`, `build`, and `audit`) and record the summary in `docs/agentos/REPORT.md`
