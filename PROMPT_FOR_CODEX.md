# Master Codex Prompt — Koya Clinic Booking Assessment

You are the senior full-stack engineer implementing my Koya Cohort 4 job assessment in this repository. This is a correctness-first assessment, not a toy CRUD demo. I want a clean, professional user interface, but the API contract, persistence, concurrency behavior, validation, and tests matter more than visual polish.

**Start by reading `AGENTS.md`, `docs/CONTRACT.md`, `CHECKLIST.md`, `STATE.md`, and `IMPLEMENTATION_LOG.md`.** Then inspect the whole repository and `git status`. Do not assume this is a fresh repo or overwrite work already completed. Use the files as persistent memory across Codex sessions.

## Goal and constraints

Build and verify all five levels of the Clinic Booking API assessment plus a polished small web page. The public API must match the routes, JSON formats, status codes, and headers documented in `docs/CONTRACT.md`. The supplied live reference is https://koyaacademy.com/assessment-api and its OpenAPI document is https://koyaacademy.com/assessment-api/openapi.json. Try to retrieve the current OpenAPI document from this environment and compare it with the provided contract. If it is unavailable, do not waste time retrying indefinitely: use `docs/CONTRACT.md` as the working specification and record any uncertainty.

### Preferred stack

- Next.js App Router, React, TypeScript, Tailwind CSS, and `lucide-react` for UI icons.
- PostgreSQL via Neon (or a clearly documented equivalent if the repo already has a working choice), with checked-in SQL migrations. Never use process memory or a JSON file for booking state.
- Zod or similarly strong schema validation, but keep validation behavior aligned with the contract.
- Unit and database integration tests. Add any test libraries only when useful and keep the setup straightforward.
- Deploy target is Vercel, but **do not deploy, create a remote, push code, or operate GitHub/Vercel for me**. I will do all hosting and repository publishing myself.

Use Node.js runtime for handlers that need PostgreSQL transactions. Keep secrets server-side. The UI must not expose `KOYA_API_KEY` in any browser bundle or `NEXT_PUBLIC_*` variable. The page should use the actual public API contract through server-side fetch/server actions that add `X-API-Key` internally. Configure the API base URL through a server-only `APP_BASE_URL` environment variable, with a safe local-development fallback. Force dynamic rendering wherever necessary so Vercel does not try to call the API or database during static build.

## Quality bar

1. **Exact contract first.** No path prefix; endpoint paths are root-relative. Every contract route, including reads and `/reset`, enforces `X-API-Key`. JSON errors are always `{ "error": "message" }`.
2. **Real database invariants.** A partial unique index for confirmed bookings per slot must enforce single occupancy even under simultaneous requests. Use transactions and appropriate row/advisory locks where needed. Do not rely only on a “check then insert” in application code.
3. **Idempotency is persistent and concurrency-safe.** The same `Idempotency-Key` plus semantically identical JSON body returns the stored status and exact body/booking ID. Reusing that key with a different body returns 422. Concurrent requests with the same key must not create duplicates. Canonicalize JSON object key order before calculating a request fingerprint. Replaying an existing key should return its saved response before a fresh rate-limit decision so retries remain deterministic.
4. **Rate limiting is per normalized email.** Allow at most five new attempts in the active minute window; the first five attempts count even when later validation or booking fails. The sixth returns 429 plus integer-seconds `Retry-After`. Different emails have independent windows. Document the precise rolling/fixed-window choice. Do not count unauthenticated requests as booking attempts. For missing/unusable email, validate safely and explain how it is treated.
5. **Cancellation frees a slot.** A cancelled booking no longer occupies the slot; another patient can book it if it has not started. Cancelling an already-cancelled booking returns 409.
6. **No accidental contract drift.** In particular, `DELETE /bookings/{id}` success must return status `cancelled` because the endpoint description says it sets status to cancelled; the example response showing `confirmed` is an apparent copy/paste inconsistency.
7. **Durable and deployable.** Include migration scripts, `.env.example`, Vercel/Neon setup instructions, and safe database connection lifecycle. Missing environment variables must fail clearly and securely; never silently fall back to in-memory storage.
8. **Professional UI.** Responsive and accessible clinic booking experience: available slots ordered by start time, exact provider filter, patient name/email form, clear loading/errors, booking confirmation with ID/status/time, and a simple way to look up a person's bookings and cancel a booking. Cancelled slots should show as available. Do not build unnecessary authentication, payments, admin dashboards, or unrelated features.
9. **Honest verification.** Run format/lint, TypeScript check, unit tests, database integration tests if a dedicated test DB is configured, and production build. If a real database is unavailable, implement the tests and clearly label integration tests not run; do not claim concurrency has been proven by unit tests alone.

## Implementation phases — do these in order

Proceed from one phase to the next without asking me for routine approval. Complete the most useful work possible in each session. Do not attempt one enormous patch; work in small, testable milestones. At the start and end of every phase update `STATE.md`, `CHECKLIST.md`, and `IMPLEMENTATION_LOG.md`. Before beginning a phase, record what you intend to change; after it, record files touched, commands actually run, outcomes, and any blockers. If time/context/usage limits are approaching, finish the current safe milestone and checkpoint immediately. Leave no uncertainty about where to resume.

### Phase 0 — Inspect and plan

- Read repository instructions/spec and inspect the repo.
- Try to compare against the published OpenAPI JSON once. Treat the supplied contract as canonical if network access fails.
- Establish the actual current state in `STATE.md`; preserve any existing work.
- Confirm project bootstrap/dependency versions using the repo's existing tooling and current stable compatible packages. Do not perform deployment actions.

### Phase 1 — Foundation and Levels 1–2

- Establish Next.js + React + TypeScript + Tailwind, scripts for dev/build/lint/typecheck/test/migrate, and a polished responsive page shell.
- Implement lazy server-only DB configuration and SQL migration(s) for slots, bookings, idempotency storage, and rate-limit state. Add useful DB constraints and indexes.
- Implement a shared JSON response/error helper and constant-time API-key comparison (length-check first to avoid `timingSafeEqual` size exceptions). Missing server-side key configuration must fail closed and must not echo secrets.
- Implement and test `POST /reset`, `GET /slots`, `POST /bookings`, and `GET /bookings/{id}` for Level 1; finish field/email validation, trimming/lowercasing requirements, exact provider filter, UTC timestamp handling, and all-request API-key auth for Level 2.
- `/reset` must allow slots in the past. Booking creation must reject a slot that has already started based on server time. `/slots` returns every slot earliest-first and calculates `available` from confirmed bookings (cancelled bookings do not occupy a slot).
- Make malformed JSON and malformed reset bodies return safe 400 JSON errors. Validate sensible slot data (`id`, `provider`, valid start/end timestamps, `end > start`, duplicate IDs) without rejecting past slots.
- Update checklist and run checks before proceeding.

### Phase 2 — Level 3 correctness

- Enforce atomic “one confirmed booking per slot” at the database level with a unique partial index, backed by a transaction and slot row lock where feasible.
- Implement `DELETE /bookings/{id}`: 404 when absent, 409 when already cancelled, 200 with returned booking status set to `cancelled`; transactionally free the slot.
- Add tests that race multiple parallel booking requests for the same slot and assert exactly one 201 and all other valid competing attempts are 409 (unless rate limiting is intentionally reached first; isolate/reset test state to test the concurrency invariant).
- Test that cancellation releases a slot and cancelled records remain retrievable/listable.

### Phase 3 — Level 4 correctness

- Implement persistent `Idempotency-Key` handling for `POST /bookings`. A body fingerprint must be deterministic regardless of JSON property order. Use database locking/uniqueness so simultaneous requests with one key do not double-book or produce inconsistent responses.
- Persist response status and full response JSON for repeatable results, including deterministic error results when the request parsed successfully. Same key + different body returns 422. Store/return the original 201 body and ID for a successful replay. Ensure response headers such as `Retry-After` are replayed where applicable.
- Implement `GET /bookings?email=...&limit=...&cursor=...`: email required, case-insensitive match, default limit 10, only integer limits 1–50 allowed, oldest-first order, opaque cursor pagination with stable `(created_at, id)` tie-breaking, lookahead to determine `next_cursor`, and `next_cursor: null` on the last page. Invalid cursors return safe 400 errors.
- Add tests for key replay, different body with same key, concurrent same-key replay, invalid limits, multiple pages, case-insensitive email lookup, and final null cursor.

### Phase 4 — Level 5 rate limiting

- Implement a per-normalized-email minute window that counts the first five POST attempts, including attempts that fail business validation (for a supplied email). Use atomic database updates/row locking so simultaneous calls cannot exceed the limit.
- The 6th new attempt within the window returns 429 and a `Retry-After` header containing a positive whole number of seconds until retry is permitted. Another email must remain unaffected. Avoid a design where repeated rejected 429 calls perpetually extend the lockout.
- Decide and document ordering clearly: an existing idempotency key replay returns its original result; a new idempotency key/ordinary request consumes a rate-limit attempt. Do not count missing/wrong API-key requests as booking attempts.
- Add tests for five attempts, the sixth response/header, failed attempts counted, email isolation, expiry/reset behavior, and parallel requests at the threshold.

### Phase 5 — Finish the user interface

- Make `/` a polished responsive app using React + TypeScript + Tailwind. A coherent clinic identity, accessible form labels, sufficient contrast, keyboard focus states, responsive desktop/mobile layout, and clear empty/loading/error/success states are required.
- Let a user list available slots, filter by provider (exact provider semantics), book with name and email, see confirmation details, look up bookings by email with pagination, and cancel a confirmed booking. Reflect cancellation/availability after refresh.
- The frontend must call the deployed API through server-side logic using `X-API-Key`; verify the key is absent from browser JS/network requests to core API routes. Do not add the key to local storage, a client component, source control, or any `NEXT_PUBLIC_*` variable.
- Keep the interface focused on the assessment. No fake booking data in production path; seed fixtures are for tests only.

### Phase 6 — Final QA, docs, and handoff

- Ensure no route accidentally gets an `/api` prefix and all routes return contract-compliant JSON.
- Add tests for 401 missing/wrong key on all routes; 400 missing/invalid booking fields and invalid email; 404 missing slot/booking; 400 past-start slot; 409 slot conflict/already-cancelled; 422 idempotency conflict; 429 + `Retry-After`; provider matching; sort order; reset behavior; and persistence across independent requests.
- Add a test that resets and re-seeds state deterministically, but never let tests point at a production database. Use a clearly separate `DATABASE_URL_TEST` and require an explicit opt-in for destructive integration tests.
- Run `npm run lint`, `npm run typecheck`, `npm test`, (integration tests with a dedicated DB when configured), and `npm run build`. Fix all failures that are possible without external credentials. Capture exact results in `STATE.md` and `IMPLEMENTATION_LOG.md`.
- Document local setup, environment variables, migration instructions, test commands, endpoint examples, Vercel/Neon setup, how to seed demo slots, and the short Loom walkthrough in `README.md` and `docs/DEPLOYMENT_AND_DEMO.md`.
- Keep this repo clean: `.env.local`, secrets, build output, `node_modules`, production data, and test DB credentials must not be tracked. Do not deploy or push anything.
- Mark each checklist item accurately. At the end, report only concise final status: implementation completed/partial, actual check results, anything requiring my credentials/action, and exact Vercel/GitHub handoff steps.

## Database / behavior notes

- Store timestamps as `timestamptz` and serialize response timestamps as ISO-8601 UTC strings ending in `Z`.
- A slot may have historical or future timestamps. Listing includes every slot, including past slots. Only booking rejects a start time `<= now`.
- A slot is available if no booking with status `confirmed` occupies it; cancelled bookings remain in history.
- Normalize stored email as `trim().toLowerCase()` and stored name as `trim()`. Validate the email before attempting to create a booking.
- The same booking id must be returned for a successful idempotency replay. The idempotency response and booking creation must be committed atomically.
- Build query pagination carefully: deterministic order, parameterized SQL, no concatenated user input, no offsets that cause skipped/duplicated records when data changes.
- Use parameterized SQL for every user-provided value.
- If reset clears idempotency/rate-limit state, do so in the same reset transaction and document it as deterministic test-fixture reset behavior. Do not leave idempotency records pointing to bookings removed by reset.
- Don't invent endpoint fields. Responses must match the contract's field names: `slot_id`, `created_at`, `status`, `available`, `next_cursor`.

## Session-end checkpoint protocol

Before stopping for any reason:

1. Update `[x]`, `[~]`, or `[ ]` statuses in `CHECKLIST.md` to reflect reality.
2. Replace the “Current phase / next action” fields in `STATE.md` with the exact stopping point, last successful command, current failures, files most recently touched, and the single next best task/command.
3. Append one short dated (UTC) entry to `IMPLEMENTATION_LOG.md`.
4. Make sure no secrets are written to these files.

When resumed, start by re-reading these files and verifying `git status`; continue from the first incomplete checklist item. Do not re-do completed work unless tests or code inspection reveal it is necessary.
