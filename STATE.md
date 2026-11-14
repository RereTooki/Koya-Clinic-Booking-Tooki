# Durable Codex state

## Current phase

- Phase: 6 — QA / handoff checkpoint.
- Status: Neon project creation, environment linking, schema migration, and isolated database integration verification are complete. The only remaining assessment item is hands-on browser UI verification.
- Last updated: 2026-11-14.

## Current repository state

- Next.js App Router application, Tailwind UI, root contract routes, server actions, migration, unit tests, expanded opt-in integration tests, and deployment docs have been added.
- Contract route files are `src/app/reset/route.ts`, `src/app/slots/route.ts`, `src/app/bookings/route.ts`, and `src/app/bookings/[id]/route.ts`; there is no `/api` prefix.
- PostgreSQL is the only durable state layer. The linked Neon primary project has `db/migrations/001_initial.sql` applied; a separate expiring Neon branch is stored only as `DATABASE_URL_TEST` for destructive tests.
- The live OpenAPI endpoint was attempted once and was inaccessible from this environment; `docs/CONTRACT.md` remains the canonical specification.

## Last successful verification

- `npm run migrate` — passed: applied `db/migrations/001_initial.sql` to the linked Neon primary database.
- `npm run test:integration` — passed: 1 integration file, 7 tests, against the isolated `DATABASE_URL_TEST` branch.
- `npm test` — passed: 3 files, 11 tests.
- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm run build` — passed; root contract routes and `/` are dynamic as expected.
- `git diff --check` — passed.
- Most recent static run: `npm test` (3 files, 11 tests), `npm run lint`, `npm run typecheck`, `npm run build`, and `git diff --check` passed.

## Decisions to preserve

- API key and database URL remain server-only; the UI reaches the public contract through server actions using `APP_BASE_URL` (with a local fallback).
- The rate limiter uses a fixed 60-second window beginning with a normalized email’s first new attempt. Replays occur before limiter evaluation; new requests with supplied non-empty string emails consume attempts before other booking validation.
- Reset clears slots, bookings, idempotency records, and rate limits atomically for deterministic fixtures.
- `POST /reset` responds `{"ok":true}` because the supplied contract did not specify a success body.
- Cancellation returns `status: "cancelled"`, following the explicit endpoint description rather than the contradictory example.

## Blockers

- No external credential blocker remains. Browser UI interaction has not been manually exercised against the linked primary database.

## Exact next action

1. Start the local app with the linked primary environment and manually exercise slot listing, booking, lookup/pagination, and cancellation in a browser; record the observed result.
