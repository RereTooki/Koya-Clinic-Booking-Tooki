import type { TransactionSql } from "postgres";
import { bodyFingerprint } from "@/lib/canonical-json";
import { decodeCursor, encodeCursor } from "@/lib/cursor";
import { db } from "@/lib/db";
import type { Booking, Slot } from "@/lib/types";
import { bookingInputSchema, candidateRateLimitEmail } from "@/lib/validation";

type ApiResult = { status: number; body: Record<string, unknown>; headers?: Record<string, string> };

type BookingRow = {
  id: string;
  slot_id: string;
  name: string;
  email: string;
  status: "confirmed" | "cancelled";
  created_at: Date;
  created_at_cursor?: string;
};

type SlotRow = { id: string; provider: string; start_at: Date; end_at: Date; available?: boolean };
type IdempotencyRow = {
  body_fingerprint: string;
  response_status: number;
  response_body: unknown;
  response_headers: unknown;
};
type RateLimitRow = { window_started_at: Date; attempts: number };

function bookingFromRow(row: BookingRow): Booking {
  return {
    id: row.id,
    slot_id: row.slot_id,
    name: row.name,
    email: row.email,
    status: row.status,
    created_at: new Date(row.created_at).toISOString(),
  };
}

function slotFromRow(row: SlotRow): Slot {
  return {
    id: row.id,
    provider: row.provider,
    start: new Date(row.start_at).toISOString(),
    end: new Date(row.end_at).toISOString(),
    available: Boolean(row.available),
  };
}

function result(status: number, message: string, headers?: Record<string, string>): ApiResult {
  return { status, body: { error: message }, headers };
}

function storedJsonObject(value: unknown): Record<string, unknown> {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid idempotency record");
  }
  return parsed as Record<string, unknown>;
}

function storedHeaders(value: unknown): Record<string, string> {
  return Object.fromEntries(
    Object.entries(storedJsonObject(value)).filter(([, headerValue]) => typeof headerValue === "string"),
  ) as Record<string, string>;
}

async function advisoryLock(tx: TransactionSql, key: string): Promise<void> {
  // The key itself remains uniquely stored in the table. This transactional lock only
  // serializes competing first-use requests, including the no-row-yet case.
  await tx`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
}

async function saveIdempotency(
  tx: TransactionSql,
  key: string,
  fingerprint: string,
  response: ApiResult,
): Promise<void> {
  await tx`
    INSERT INTO idempotency_records (idempotency_key, body_fingerprint, response_status, response_body, response_headers)
    VALUES (${key}, ${fingerprint}, ${response.status}, ${JSON.stringify(response.body)}::jsonb, ${JSON.stringify(response.headers ?? {})}::jsonb)
  `;
}

async function consumeRateLimit(tx: TransactionSql, email: string): Promise<ApiResult | null> {
  await advisoryLock(tx, `booking-rate-limit:${email}`);
  const rows = await tx<RateLimitRow[]>`
    SELECT window_started_at, attempts
    FROM booking_rate_limits
    WHERE email = ${email}
    FOR UPDATE
  `;
  const now = new Date();
  const current = rows[0];

  if (!current) {
    await tx`
      INSERT INTO booking_rate_limits (email, window_started_at, attempts)
      VALUES (${email}, ${now}, 1)
    `;
    return null;
  }

  const elapsedMilliseconds = now.getTime() - new Date(current.window_started_at).getTime();
  if (elapsedMilliseconds >= 60_000) {
    await tx`
      UPDATE booking_rate_limits
      SET window_started_at = ${now}, attempts = 1
      WHERE email = ${email}
    `;
    return null;
  }

  if (current.attempts >= 5) {
    const retryAfter = Math.max(1, Math.ceil((60_000 - Math.max(0, elapsedMilliseconds)) / 1_000));
    return result(429, "rate limit exceeded", { "Retry-After": String(retryAfter) });
  }

  await tx`
    UPDATE booking_rate_limits
    SET attempts = attempts + 1
    WHERE email = ${email}
  `;
  return null;
}

/** Creates a booking and optionally persists an exactly replayable idempotent response. */
export async function createBooking(payload: unknown, idempotencyKey: string | null): Promise<ApiResult> {
  const fingerprint = bodyFingerprint(payload);
  return db().begin(async (tx) => {
    if (idempotencyKey) {
      await advisoryLock(tx, `booking-idempotency:${idempotencyKey}`);
      const existing = await tx<IdempotencyRow[]>`
        SELECT body_fingerprint, response_status, response_body, response_headers
        FROM idempotency_records
        WHERE idempotency_key = ${idempotencyKey}
      `;
      if (existing[0]) {
        if (existing[0].body_fingerprint !== fingerprint) return result(422, "idempotency key was used with a different request body");
        return {
          status: existing[0].response_status,
          body: storedJsonObject(existing[0].response_body),
          headers: storedHeaders(existing[0].response_headers),
        };
      }
    }

    let response: ApiResult | null = null;
    const candidateEmail =
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? candidateRateLimitEmail((payload as Record<string, unknown>).email)
        : null;

    // A supplied non-empty email consumes a fixed one-minute attempt. This happens
    // before field/business validation, as required; absent/non-string email cannot
    // be safely assigned to a per-email bucket and is not rate-limited.
    if (candidateEmail) response = await consumeRateLimit(tx, candidateEmail);

    const parsed = bookingInputSchema.safeParse(payload);
    if (!response && !parsed.success) response = result(400, "invalid booking fields");

    if (!response && parsed.success) {
      const slotRows = await tx<SlotRow[]>`
        SELECT id, provider, start_at, end_at
        FROM slots
        WHERE id = ${parsed.data.slot_id}
        FOR UPDATE
      `;
      const slot = slotRows[0];
      if (!slot) {
        response = result(404, "slot not found");
      } else if (new Date(slot.start_at).getTime() <= Date.now()) {
        response = result(400, "slot has already started");
      } else {
        const existingBooking = await tx<{ id: string }[]>`
          SELECT id FROM bookings WHERE slot_id = ${slot.id} AND status = 'confirmed' LIMIT 1
        `;
        if (existingBooking[0]) {
          response = result(409, "slot is already booked");
        } else {
          const rows = await tx<BookingRow[]>`
            INSERT INTO bookings (slot_id, name, email, status)
            VALUES (${slot.id}, ${parsed.data.name}, ${parsed.data.email}, 'confirmed')
            RETURNING id, slot_id, name, email, status, created_at
          `;
          response = { status: 201, body: bookingFromRow(rows[0]) };
        }
      }
    }

    const finalResponse = response ?? result(500, "internal server error");
    if (idempotencyKey) await saveIdempotency(tx, idempotencyKey, fingerprint, finalResponse);
    return finalResponse;
  });
}

export async function listSlots(provider: string | null): Promise<Slot[]> {
  const rows = provider === null
    ? await db()<SlotRow[]>`
        SELECT s.id, s.provider, s.start_at, s.end_at,
          NOT EXISTS (SELECT 1 FROM bookings b WHERE b.slot_id = s.id AND b.status = 'confirmed') AS available
        FROM slots s
        ORDER BY s.start_at ASC, s.id ASC
      `
    : await db()<SlotRow[]>`
        SELECT s.id, s.provider, s.start_at, s.end_at,
          NOT EXISTS (SELECT 1 FROM bookings b WHERE b.slot_id = s.id AND b.status = 'confirmed') AS available
        FROM slots s
        WHERE s.provider = ${provider}
        ORDER BY s.start_at ASC, s.id ASC
      `;
  return rows.map(slotFromRow);
}

export async function getBooking(id: string): Promise<Booking | null> {
  const rows = await db()<BookingRow[]>`
    SELECT id, slot_id, name, email, status, created_at FROM bookings WHERE id = ${id}
  `;
  return rows[0] ? bookingFromRow(rows[0]) : null;
}

export async function cancelBooking(id: string): Promise<ApiResult> {
  return db().begin(async (tx) => {
    const rows = await tx<BookingRow[]>`
      SELECT id, slot_id, name, email, status, created_at
      FROM bookings WHERE id = ${id} FOR UPDATE
    `;
    const booking = rows[0];
    if (!booking) return result(404, "booking not found");
    if (booking.status === "cancelled") return result(409, "booking is already cancelled");

    // Take the same parent-row lock used by creation before freeing occupancy.
    await tx`SELECT id FROM slots WHERE id = ${booking.slot_id} FOR UPDATE`;
    const updated = await tx<BookingRow[]>`
      UPDATE bookings SET status = 'cancelled' WHERE id = ${booking.id}
      RETURNING id, slot_id, name, email, status, created_at
    `;
    return { status: 200, body: bookingFromRow(updated[0]) };
  });
}

export async function listBookings(
  email: string,
  limit: number,
  cursor: string | null,
): Promise<{ bookings: Booking[]; next_cursor: string | null } | null> {
  const decoded = cursor ? decodeCursor(cursor) : undefined;
  if (cursor && !decoded) return null;
  const take = limit + 1;
  const rows = decoded
    ? await db()<BookingRow[]>`
        SELECT id, slot_id, name, email, status, created_at,
          to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS created_at_cursor
        FROM bookings
        WHERE email = ${email}
          AND (
            to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
            id::text
          ) > (${decoded.created_at}, ${decoded.id})
        ORDER BY created_at ASC, id ASC
        LIMIT ${take}
      `
    : await db()<BookingRow[]>`
        SELECT id, slot_id, name, email, status, created_at,
          to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS created_at_cursor
        FROM bookings
        WHERE email = ${email}
        ORDER BY created_at ASC, id ASC
        LIMIT ${take}
      `;
  const hasNext = rows.length > limit;
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    bookings: page.map(bookingFromRow),
    next_cursor: hasNext && last
      ? encodeCursor({ created_at: last.created_at_cursor ?? new Date(last.created_at).toISOString(), id: last.id })
      : null,
  };
}

type ResetSlot = { id: string; provider: string; start: string; end: string };

export async function resetDatabase(slots: ResetSlot[]): Promise<void> {
  await db().begin(async (tx) => {
    // Reset deliberately clears dependent replay and limiter state in the same transaction.
    await tx`DELETE FROM idempotency_records`;
    await tx`DELETE FROM booking_rate_limits`;
    await tx`DELETE FROM bookings`;
    await tx`DELETE FROM slots`;
    if (slots.length) {
      await tx`
        INSERT INTO slots ${tx(slots.map((slot) => ({
          id: slot.id,
          provider: slot.provider,
          start_at: new Date(slot.start),
          end_at: new Date(slot.end),
        })), "id", "provider", "start_at", "end_at")}
      `;
    }
  });
}
