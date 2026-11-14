# Koya Clinic Booking

A correctness-first Next.js implementation of the Koya clinic booking assessment. The public API is intentionally served at the site root: `/reset`, `/slots`, `/bookings`, and `/bookings/{id}`—never under `/api`.

## What is included

- Next.js App Router, React, TypeScript, Tailwind CSS, and a responsive booking interface.
- PostgreSQL migrations for slots, bookings, idempotency records, and rate-limit state.
- Root-level contract handlers with JSON-only responses and API-key enforcement on every route.
- Database transactions, a slot-row lock, and a partial unique index to ensure only one confirmed booking occupies a slot.
- Persistent idempotency responses (including replayed `Retry-After`) and stable opaque cursor pagination.
- A fixed, per-normalized-email minute window: the first request starts the 60-second window; its first five new attempts count, including validation and business-rule failures; subsequent attempts return `429` without extending the window. A missing, empty, or non-string email has no safe per-email bucket and is rejected without consuming a bucket.

`POST /reset` is a deterministic fixture operation: it clears slots, bookings, idempotency records, and rate-limit state in one transaction.

## Local setup

1. Install Node 20.9+ and PostgreSQL (or create a Neon database).
2. Copy `.env.example` to an ignored `.env.local` and set:

   ```dotenv
   DATABASE_URL=postgresql://...
   KOYA_API_KEY=a-long-random-server-only-secret
   APP_BASE_URL=http://localhost:3000
   ```

   Do not use `NEXT_PUBLIC_` for either secret. The application fails closed when `KOYA_API_KEY` is absent and fails safely if `DATABASE_URL` is unavailable.

3. Apply the migration and start the app:

   ```bash
   npm install
   npm run migrate
   npm run dev
   ```

The home page calls the public API only from server-side code. Browser JavaScript never receives `KOYA_API_KEY` or sends it to a core API route.

## API examples

All examples require the same server-side secret as `X-API-Key`.

```bash
curl -X POST http://localhost:3000/reset \
  -H "Content-Type: application/json" -H "X-API-Key: $KOYA_API_KEY" \
  -d '{"slots":[{"id":"s1","provider":"Dr Ade","start":"2027-12-10T09:00:00Z","end":"2027-12-10T09:30:00Z"}]}'

curl "http://localhost:3000/slots?provider=Dr%20Ade" \
  -H "X-API-Key: $KOYA_API_KEY"

curl -X POST http://localhost:3000/bookings \
  -H "Content-Type: application/json" -H "X-API-Key: $KOYA_API_KEY" \
  -H "Idempotency-Key: a-client-generated-key" \
  -d '{"slot_id":"s1","name":"Ada Obi","email":"ada@example.com"}'

curl "http://localhost:3000/bookings?email=ada%40example.com&limit=10" \
  -H "X-API-Key: $KOYA_API_KEY"
```

See [the full contract](docs/CONTRACT.md) for route behavior and status codes. `POST /reset` returns `{"ok":true}` because the supplied contract does not define a success schema; this is documented as the implementation choice.

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Database integration tests are destructive by design and never fall back to `DATABASE_URL`. Configure a separate disposable `DATABASE_URL_TEST`, then explicitly opt in:

```bash
RUN_DATABASE_INTEGRATION_TESTS=1 DATABASE_URL_TEST=postgresql://... npm run test:integration
```

The integration suite checks API auth, persistence, cancellation/rebooking, concurrent slot contention, idempotency replay/conflict, the limiter, and cursor pagination. If no dedicated database is configured, the command exits successfully with an explicit skip message.

## Deployment and walkthrough

No deployment or GitHub push is performed by this repository automation. Follow [deployment and demo notes](docs/DEPLOYMENT_AND_DEMO.md) after your checks pass.
