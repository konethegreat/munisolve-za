# MuniSolve ZA Working Plan: Phases

## Phase 1: CI and Dependency Security Recovery
Goal: Restore a green `Application checks` CI pipeline by researching and resolving the failing `npm audit --audit-level=low` check in `client/` (`picomatch` via `fdir`, `tinyglobby`, and `vite`) and updating dependency documentation.
Done when: `npm --prefix server audit --audit-level=low`, `npm --prefix client audit --audit-level=low`, and all `Application checks` CI jobs pass on `main`.

## Phase 2: Client Lint Modernization and Hooks Refactor
Goal: Resolve open issue #8 by upgrading ESLint and `@eslint/js` to a supported release, removing the `eslint-plugin-react-hooks` 7.0.1 pin, and fixing the eight Hooks diagnostics across six components without regressions.
Done when: `client/` uses supported ESLint and unpinned `eslint-plugin-react-hooks`, `npm --prefix client run lint` passes with zero warnings or errors, and issue #8 acceptance criteria are met.

## Phase 3: Client Test Coverage and Frontend Hardening
Goal: Expand automated test coverage in `client/src/` beyond the current two utility test files (`sla.test.js` and `errors.test.js`) and fix minor hygiene issues such as the em-dash fallback in `client/src/utils/mapUtils.js`.
Done when: `client/src/utils/mapUtils.js`, key API/hook helpers, and core UI state flows have passing unit tests under `npm --prefix client test`.

## Phase 4: Performance Experiments and End-to-End Verification
Goal: Benchmark and optimize client bundle chunking (Leaflet, Recharts, vendor splits) after route-level code splitting, and verify the full-stack PostgreSQL workflow (`demo:verify`) and server hardening checks.
Done when: Client production build produces no chunk size warnings, bundle metrics are recorded in `docs/agentos/REPORT.md`, and `npm --prefix server run demo:verify` passes cleanly.

## Phase 5: Documentation Audit and Release Review
Goal: Align `README.md`, `docs/DEPENDENCIES.md`, and `docs/OPERATIONS.md` with current Node.js, CI, and tooling state, and perform a final constitution and quality review across the codebase.
Done when: All documentation matches actual scripts and CI workflows, no em-dashes or en-dashes remain in project docs or updated code, and all server and client checks are green.
