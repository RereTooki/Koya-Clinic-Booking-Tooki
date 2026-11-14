# Live implementation checklist

`[~]` means implemented but still awaiting the stated database-backed verification. `[x]` means the item was verified as stated.

## Phase 0 — Inspect

- [x] Read repo instructions, contract, current state, and git status.
- [x] Attempt one live OpenAPI comparison; endpoint was inaccessible from this environment, so the checked-in contract is canonical.
- [x] Confirm bootstrap and dependency versions: Next 15.5.28, React 19.3.1, TypeScript 5.9.3, Tailwind 3.4.19, PostgreSQL driver 3.4.9, Zod 3.25.76.

## Phase 1 — Foundation / Levels 1–2

- [x] Next.js + React + TypeScript + Tailwind foundation and scripts; production build passes.
- [x] PostgreSQL schema migration and server-only database access verified against the linked Neon project.
- [x] API-key auth and safe JSON error helper; unit tests cover every public route’s missing/wrong-key `401` response.
- [x] `POST /reset` transactional replacement and dependent-state cleanup verified by integration tests.
- [x] `GET /slots` sorting, exact provider filter, and confirmed-booking availability verified by integration tests.
- [x] `POST /bookings` normalization, validation, not-found, and past-slot handling verified by integration tests.
- [x] `GET /bookings/{id}` and proper error statuses verified by integration tests.
- [x] Validation, malformed-JSON, and API-auth/fail-closed unit tests pass (11 tests total).

## Phase 2 — Level 3

- [x] Partial unique confirmed-booking index, transaction/slot locking, cancellation behavior, and same-slot race tests pass on the disposable Neon test branch.

## Phase 3 — Level 4

- [x] Persistent idempotency fingerprints/replays, strict list query validation, and stable cursor pagination pass on the disposable Neon test branch.

## Phase 4 — Level 5

- [x] Atomic fixed-window per-email limiter, deterministic idempotency ordering, `Retry-After`, expiry, isolation, and parallel threshold tests pass on the disposable Neon test branch.

## Phase 5 — Web UI

- [~] Responsive slot filter/list, accessible booking form, confirmation, lookup/pagination, and cancellation UI are implemented through server actions. The production build passes; live flow verification needs configured server credentials/database.

## Phase 6 — Final QA / handoff

- [x] `npm run lint` passes.
- [x] `npm run typecheck` passes.
- [x] `npm test` passes (3 files, 11 tests).
- [x] Database integration suite passes against the dedicated disposable Neon test branch: 1 file, 7 tests covering reset, lifecycle, conflict, idempotency, pagination, limiter, and concurrency.
- [x] `npm run build` passes.
- [x] `.env.example`, migration, setup, API examples, deployment, and Loom-demo documentation are complete.
- [x] `STATE.md` and `IMPLEMENTATION_LOG.md` record the actual checkpoint and commands.
- [x] No secrets or generated build artifacts are tracked (`.env*`, `.next`, `node_modules`, and `*.tsbuildinfo` are ignored).
- [x] No GitHub push or Vercel deployment was performed.
