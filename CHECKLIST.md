# Live implementation checklist

Codex must update this file as work progresses. `[~]` means in progress; `[x]` means implemented **and verified as stated**; `[ ]` means not complete. Do not mark implementation and verification complete merely because code exists.

## Phase 0 — Inspect
- [ ] Read repo instructions, contract, current state, and git status.
- [ ] Attempt one live OpenAPI comparison; record whether reachable.
- [ ] Confirm bootstrap and chosen dependency versions.

## Phase 1 — Foundation / Levels 1–2
- [ ] Next.js + React + TypeScript + Tailwind foundation and scripts.
- [ ] PostgreSQL schema migrations and server-only database access.
- [ ] API-key auth on every contract route; safe JSON error helper.
- [ ] `POST /reset` persists replacement slots and deletes prior bookings.
- [ ] `GET /slots` sorting, exact provider filter, correct availability.
- [ ] `POST /bookings` validation, normalization, not-found, past-slot behavior.
- [ ] `GET /bookings/{id}` and proper error statuses.
- [ ] Validation/API auth tests pass.

## Phase 2 — Level 3
- [ ] Database-enforced single confirmed booking per slot.
- [ ] Transaction-safe booking flow under concurrent requests.
- [ ] `DELETE /bookings/{id}` correct 200/404/409 and status `cancelled`.
- [ ] Cancellation releases slot; cancellation/concurrency tests pass.

## Phase 3 — Level 4
- [ ] Concurrent-safe persistent idempotency storage and body fingerprinting.
- [ ] Same key/body replays saved response; different body returns 422.
- [ ] `GET /bookings` case-insensitive email matching and strict limit validation.
- [ ] Stable oldest-first cursor pagination and final `next_cursor: null`.
- [ ] Idempotency and pagination tests pass.

## Phase 4 — Level 5
- [ ] Atomic per-normalized-email minute limiter.
- [ ] First five attempts count including business validation failures.
- [ ] Sixth request returns 429 + positive whole-second `Retry-After`.
- [ ] Other emails isolated; over-limit calls do not extend lockout forever.
- [ ] Rate-limit boundary, failure, expiry, and concurrency tests pass.

## Phase 5 — Web UI
- [ ] Slot listing, provider filter, loading/empty/error states.
- [ ] Accessible booking form and clear confirmation with booking ID.
- [ ] Booking lookup/list with pagination and cancel action.
- [ ] UI uses real endpoints via server-side code; key is not in browser bundle.
- [ ] Responsive layout and clear mobile behavior.

## Phase 6 — Final QA / handoff
- [ ] `npm run lint` passes.
- [ ] `npm run typecheck` passes.
- [ ] `npm test` passes.
- [ ] Integration tests pass against a dedicated test DB, or are explicitly marked not run with reason.
- [ ] `npm run build` passes.
- [ ] `.env.example`, migrations, setup and deployment docs completed.
- [ ] `README.md` includes API examples, seeding, Vercel/Neon handoff, and Loom walkthrough.
- [ ] `STATE.md` and `IMPLEMENTATION_LOG.md` reflect the actual final status.
- [ ] No secrets, production DB credentials, or build artifacts tracked.
- [ ] No GitHub push or Vercel deployment performed by Codex.
