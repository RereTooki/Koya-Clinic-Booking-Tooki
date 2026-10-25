# Intended architecture

Codex may refine implementation details, but preserve these invariants and communicate material deviations.

## Runtime layers

- **Presentation:** Next.js App Router page and focused React client components, styled with Tailwind. The browser must never receive `KOYA_API_KEY`.
- **Web-to-API adapter:** server-side calls to the exact public routes using `X-API-Key`; configure its origin via server-only `APP_BASE_URL` and use a safe local fallback. No client-side key or open `/ui-api` bypass.
- **Contract API:** root-level Next.js route handlers for `/reset`, `/slots`, `/bookings`, and `/bookings/[id]`; these enforce the header even for GET endpoints.
- **Domain/data layer:** validated inputs, parameterized PostgreSQL queries, transaction boundaries, reusable error mapping.
- **Persistence:** checked-in SQL migrations; no in-memory state.

## Suggested database invariants

- `slots`: primary key `id`, `provider`, `start_at`, `end_at`, with `end_at > start_at`.
- `bookings`: primary key `id`, foreign key `slot_id`, trimmed name, normalized email, status constraint (`confirmed` or `cancelled`), creation timestamp.
- Partial unique index over `bookings(slot_id) WHERE status = 'confirmed'`, so at most one confirmed booking exists per slot even if application locking regresses.
- `idempotency_records`: unique key, request fingerprint, response status, complete response JSON, optional replay headers, creation timestamp.
- Per-email rate-limit state: normalized email primary key, window start, and count; update/lock atomically within the booking transaction.

## Transaction patterns

- Booking: API-key auth → parse body → determine idempotency key/fingerprint → transactionally lock/check existing idempotency record → return replay or reject body mismatch → atomically consume rate-limit attempt → validate request and slot → lock slot row → insert booking (let the unique index arbitrate races) → persist idempotency response → commit.
- Store deterministic business error responses for parsed bodies with a valid idempotency key, so retries replay the same status/body. Do not store unauthenticated responses. For malformed JSON, no stable parsed body exists; respond 400 safely.
- Cancellation: transactionally lock booking; return 404 if missing, 409 if already cancelled, otherwise update to cancelled and return the updated booking.
- Reset: one transaction replaces slots and deletes bookings. If idempotency and rate-limit state are reset too, do so consistently and document it as a deterministic fixture-reset behavior.
- List bookings: use a stable `(created_at, id)` ascending tuple cursor; query `limit + 1` to know whether a next page exists.

## Test strategy

- Unit tests: input validation, email normalization, stable body fingerprint, cursor encode/decode, retry-after calculation, error mapping.
- Integration tests against a dedicated disposable database: auth on every route, full CRUD flow, same-slot concurrency, same-key concurrency/replay, key/body mismatch, pagination, limiter boundary and email isolation, cancellation releases slot, and state persistence across independent requests.
- Do not claim concurrent correctness from mock-only tests.
