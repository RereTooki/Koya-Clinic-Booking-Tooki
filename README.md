# Koya Clinic Booking

Koya Clinic Booking is a small appointment-booking application built for the Koya assessment. It includes a responsive booking interface and a root-level HTTP API for loading slots, creating and managing bookings, and resetting fixture data.

The implementation keeps the booking rules in PostgreSQL so that the behaviour remains correct when more than one request reaches the application at the same time.

## Stack

- **Next.js App Router and React** provide the web interface, server actions, and route handlers in one TypeScript project.
- **TypeScript** keeps request, response, and database data explicit.
- **Tailwind CSS** is used for the responsive interface without adding a component library.
- **PostgreSQL** provides durable slots, bookings, idempotency records, and rate-limit state. Neon is a suitable hosted PostgreSQL option for Vercel.
- **Zod** validates incoming API data before it reaches the booking service.
- **Vitest** covers route authentication, validation, and database-backed behaviour.

## Architecture

The public contract routes are served at the site root; there is deliberately no `/api` prefix. The web page uses server-side actions to call those routes, so `KOYA_API_KEY` stays on the server and is never sent to browser JavaScript.

```text
Browser -> Next.js server action -> root contract route -> booking service -> PostgreSQL
```

Each route returns JSON. Error responses use the contract shape `{ "error": "..." }`. The detailed request and response contract is in [docs/CONTRACT.md](docs/CONTRACT.md).

## API

All public routes require an `X-API-Key` header. Missing or invalid keys return `401` with a JSON error.

| Route | Behaviour |
| --- | --- |
| `POST /reset` | Replaces the slot fixtures and clears dependent booking, idempotency, and rate-limit data in one transaction. |
| `GET /slots` | Returns slots in start-time order. The optional `provider` query performs an exact provider match and each slot includes `available`. |
| `POST /bookings` | Validates and normalizes booking data, creates a confirmed booking, and returns the contract response. |
| `GET /bookings/{id}` | Returns one booking by ID. |
| `DELETE /bookings/{id}` | Cancels a confirmed booking. A cancelled slot can be booked again. |
| `GET /bookings` | Lists bookings for an email address, with validated limits and cursor pagination. |

`POST /bookings` accepts an `Idempotency-Key` header. Request timestamps are ISO 8601 UTC strings. See the contract for the precise required fields, status codes, and response bodies.

## Database and migrations

The initial migration is [db/migrations/001_initial.sql](db/migrations/001_initial.sql). It creates:

- `slots` for clinician availability;
- `bookings` for confirmed and cancelled appointments;
- `idempotency_records` for persisted request fingerprints and replay responses; and
- `booking_rate_limits` for per-email fixed-window counters.

The migration also creates a partial unique index that permits only one **confirmed** booking for a slot. This is the final database-level safeguard against double booking.

Run migrations with:

```bash
npm run migrate
```

## Booking rules and concurrency

The booking service normalizes names and email addresses, validates the payload and slot, and rejects slots in the past. Booking a slot runs in a database transaction and locks the target slot row before checking and creating the booking. The transaction, partial unique index, and conflict handling protect the result under concurrent requests; there is no in-memory lock to coordinate bookings.

Cancelling a booking updates its status rather than removing history. Because the unique index applies only to confirmed bookings, a later booking can use that slot.

## Idempotency, pagination, and rate limiting

For a booking request with an idempotency key, the application stores a fingerprint of the request and the completed response. Repeating the same request returns the stored result. Reusing a key with different request data is rejected. Idempotency is resolved before rate limiting so a safe replay does not consume another attempt.

Booking history uses an opaque cursor based on the full database timestamp and booking ID. This keeps ordering stable even when timestamps share the same displayed millisecond.

New booking attempts are limited per normalized email address in a fixed 60-second window. The first five attempts count, including validation and business-rule failures. Later attempts return `429` with `Retry-After`; the database update is atomic so concurrent requests share the same limit.

## Local setup

Requirements: Node.js 20.9+ and a PostgreSQL database. A Neon database works well for local development and Vercel deployments.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to the ignored `.env.local` file and set placeholders for your environment:

   ```dotenv
   DATABASE_URL=postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require
   KOYA_API_KEY=replace-with-a-long-random-server-only-value
   APP_BASE_URL=http://localhost:3000
   ```

   For database integration tests, use a separate disposable database or Neon branch:

   ```dotenv
   DATABASE_URL_TEST=postgresql://USER:PASSWORD@HOST/TEST_DATABASE?sslmode=require
   ```

   Keep `DATABASE_URL`, `DATABASE_URL_TEST`, and `KOYA_API_KEY` server-only. Do not use `NEXT_PUBLIC_` for them and do not commit `.env.local`.

3. Apply the migration, then start the development server:

   ```bash
   npm run migrate
   npm run dev
   ```

Open `http://localhost:3000` to use the web interface.

## Commands

```bash
# Unit tests
npm test

# Linting and TypeScript checks
npm run lint
npm run typecheck

# Production build
npm run build
```

Database integration tests reset their target database. They intentionally require both an explicit opt-in and `DATABASE_URL_TEST`; they never fall back to `DATABASE_URL`.

```bash
RUN_DATABASE_INTEGRATION_TESTS=1 DATABASE_URL_TEST=postgresql://USER:PASSWORD@HOST/TEST_DATABASE?sslmode=require npm run test:integration
```

## Vercel deployment

Create the PostgreSQL database and run `npm run migrate` against it before serving traffic. In the Vercel project settings, configure these server-side environment variables for the appropriate environment:

- `DATABASE_URL`
- `KOYA_API_KEY`
- `APP_BASE_URL` set to the deployed application URL

`DATABASE_URL_TEST` is for the dedicated test database only and is not needed by the deployed application. Do not expose either database URL or the API key to the client.

## Implementation notes

- The API follows the supplied route and response contract rather than reshaping it for the web UI.
- `POST /reset` is a fixture operation for development and tests, not a general administrative workflow.
- Database constraints and transactions are the source of truth for booking safety, idempotency, and rate limiting.
- The interface displays times in the visitor's local time zone while the API stores and exchanges UTC timestamps.
- Route handlers force JSON responses, including error cases, to keep API consumers predictable.

For deployment and assessment walkthrough guidance, see [docs/DEPLOYMENT_AND_DEMO.md](docs/DEPLOYMENT_AND_DEMO.md).
