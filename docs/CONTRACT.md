# Koya Clinic Booking API — working contract

Reference page: <https://koyaacademy.com/assessment-api>  
OpenAPI JSON: <https://koyaacademy.com/assessment-api/openapi.json>

This file records the contract pasted by the candidate. If the live OpenAPI spec is reachable, compare it before implementation. The assessment spec takes precedence over preferences or assumptions. The live JSON was not retrievable in the preparation environment, so no unseen schema details are inferred here.

## Shared rules

- JSON request/response bodies.
- Every public endpoint requires `X-API-Key` (Level 2). Missing/wrong key → `401`, body `{"error":"..."}`.
- Every error body is an object with only an `error` string.
- Do not use an `/api` prefix; paths below are exact.
- Persist data in PostgreSQL; requests must see data created by earlier requests.
- Timestamps emitted in responses should be ISO-8601 UTC strings.

## `POST /reset` — Level 1

Request:

```json
{
  "slots": [
    { "id": "s1", "provider": "Dr Ade", "start": "2026-12-10T09:00:00Z", "end": "2026-12-10T09:30:00Z" }
  ]
}
```

- Replaces all slots and deletes every booking.
- Supplied slots may be in the past.
- Success: `200` (no specific success body was shown; a small JSON confirmation such as `{"ok":true}` is sensible if the live OpenAPI does not further specify it).

## `GET /slots` — Level 1

Optional query: `provider` (string; exact match). Response `200`:

```json
{
  "slots": [
    { "id": "s1", "provider": "Dr Ade", "start": "2026-12-10T09:00:00Z", "end": "2026-12-10T09:30:00Z", "available": true }
  ]
}
```

All slots, earliest `start` first. `available` reflects whether the slot has a confirmed booking; cancellations free it.

## `POST /bookings` — Levels 1–5

Optional header: `Idempotency-Key` (Level 4). Request:

```json
{ "slot_id": "s1", "name": "Ada Obi", "email": "ada@example.com" }
```

Success: `201` and:

```json
{
  "id": "string",
  "slot_id": "s1",
  "name": "Ada Obi",
  "email": "ada@example.com",
  "status": "confirmed",
  "created_at": "2026-10-25T18:15:46.288Z"
}
```

Behavior and status codes:

- `400`: `slot_id`, `name`, or `email` missing/empty; invalid email; or slot already started. Trim `name` and `email`; store email lowercase.
- `404`: slot does not exist.
- `409`: slot already has a confirmed booking, including concurrent attempts.
- `422`: same idempotency key used with a different request body.
- `429`: more than five new attempts for the same normalized email in a minute window; include `Retry-After` in whole seconds. Failed attempts count. Different emails have independent limits.
- Same idempotency key + same body returns the same saved status/body and booking ID, without creating another booking.
- A request that uses a slot with `start <= server_now` returns `400`.

## `GET /bookings/{id}` — Level 1

- `200`: booking object with the six fields above, including its current `status`.
- `404`: no booking with that ID.

## `DELETE /bookings/{id}` — Level 3

- `200`: the cancelled booking object, with `status: "cancelled"`.
- `404`: no booking with that ID.
- `409`: booking is already cancelled.
- Cancelling releases the slot for a later booking, provided it has not started.
- The pasted response example incorrectly shows `status: "confirmed"`, while the endpoint description says the status is set to cancelled. Follow the explicit endpoint behavior and return `cancelled`.

## `GET /bookings` — Level 4

Required query: `email`. Optional query: `limit` (default `10`, valid integer `1` to `50`) and `cursor`.

Response `200`:

```json
{
  "bookings": [
    {
      "id": "string",
      "slot_id": "s1",
      "name": "Ada Obi",
      "email": "ada@example.com",
      "status": "confirmed",
      "created_at": "2026-10-25T18:15:46.295Z"
    }
  ],
  "next_cursor": "string"
}
```

- Match email ignoring case.
- Oldest first, deterministically tie-broken.
- Use opaque cursor pagination; clients pass `next_cursor` back as `cursor`.
- Last page returns `next_cursor: null`.
- Invalid limit → `400`; missing email and malformed cursor should also be handled with safe `400` errors.
- Include cancelled records in the person's booking history.

## Contract points to verify against live OpenAPI

- Exact body for `POST /reset` success (the excerpt names `200 Done` but does not show a JSON schema for its body).
- Exact error message text is not specified; do not rely on the example placeholder `"slot not found"` for every error. Ensure only the documented shape and status are used.
- Whether live spec sets additional field formats/lengths; follow it if discoverable.
