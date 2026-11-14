import { afterAll, beforeEach, describe, expect, it } from "vitest";
import postgres from "postgres";
import { POST as reset } from "@/app/reset/route";
import { GET as getSlots } from "@/app/slots/route";
import { GET as getBookings, POST as createBooking } from "@/app/bookings/route";
import { DELETE as deleteBooking, GET as getBooking } from "@/app/bookings/[id]/route";
import { createBooking as createBookingService } from "@/lib/booking-service";

const origin = "http://localhost:3000";
const apiKey = "integration-test-key";
const headers = { "X-API-Key": apiKey, "Content-Type": "application/json" };
const testSql = postgres(process.env.DATABASE_URL_TEST!, { max: 1, prepare: false });
const future = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();
const past = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

type ResetSlot = { id: string; provider: string; start: string; end: string };

async function resetSlots(count = 3): Promise<void> {
  const slots: ResetSlot[] = Array.from({ length: count }, (_, index) => ({
    id: "s" + String(index + 1),
    provider: index % 2 ? "Dr Bisi" : "Dr Ade",
    start: future(120 + index * 30),
    end: future(145 + index * 30),
  }));
  const response = await reset(new Request(origin + "/reset", {
    method: "POST",
    headers,
    body: JSON.stringify({ slots }),
  }));
  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({ ok: true });
}

function bookingRequest(body: object, extraHeaders: Record<string, string> = {}) {
  return createBooking(new Request(origin + "/bookings", {
    method: "POST",
    headers: { ...headers, ...extraHeaders },
    body: JSON.stringify(body),
  }));
}

function idContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(async () => resetSlots());
afterAll(async () => testSql.end({ timeout: 5 }));

describe("reset and slot listing", () => {
  it("accepts historical fixture slots, atomically resets state, sorts starts, and exactly filters providers", async () => {
    const slots: ResetSlot[] = [
      { id: "later", provider: "Dr Ade", start: future(240), end: future(270) },
      { id: "past", provider: "Dr Ade", start: past(60), end: past(30) },
      { id: "middle", provider: "Dr Bisi", start: future(120), end: future(150) },
    ];
    const response = await reset(new Request(origin + "/reset", {
      method: "POST",
      headers,
      body: JSON.stringify({ slots }),
    }));
    expect(response.status).toBe(200);

    const all = await getSlots(new Request(origin + "/slots", { headers: { "X-API-Key": apiKey } }));
    expect((await all.json()).slots.map((slot: { id: string }) => slot.id)).toEqual(["past", "middle", "later"]);
    const filtered = await getSlots(new Request(origin + "/slots?provider=Dr%20Ade", { headers: { "X-API-Key": apiKey } }));
    expect((await filtered.json()).slots.map((slot: { id: string }) => slot.id)).toEqual(["past", "later"]);

    expect((await bookingRequest({ slot_id: "middle", name: "Ada", email: "ada@example.com" }, { "Idempotency-Key": "cleared-by-reset" })).status).toBe(201);
    await resetSlots();
    expect((await bookingRequest({ slot_id: "s2", name: "Ada", email: "ada@example.com" }, { "Idempotency-Key": "cleared-by-reset" })).status).toBe(201);
  });

  it("returns safe 400 JSON errors for malformed or invalid reset bodies", async () => {
    const malformed = await reset(new Request(origin + "/reset", { method: "POST", headers, body: "{" }));
    expect(malformed.status).toBe(400);
    await expect(malformed.json()).resolves.toEqual({ error: "invalid JSON body" });

    const duplicate = await reset(new Request(origin + "/reset", {
      method: "POST",
      headers,
      body: JSON.stringify({
        slots: [
          { id: "same", provider: "Dr Ade", start: future(60), end: future(90) },
          { id: "same", provider: "Dr Ade", start: future(120), end: future(150) },
        ],
      }),
    }));
    expect(duplicate.status).toBe(400);
    await expect(duplicate.json()).resolves.toEqual({ error: "invalid reset body" });
  });
});

describe("booking lifecycle and database invariants", () => {
  it("enforces auth, normalizes storage, reports errors, and frees a cancelled slot", async () => {
    expect((await getSlots(new Request(origin + "/slots"))).status).toBe(401);
    expect((await bookingRequest({ slot_id: "s1", name: "Ada", email: "ada@example.com" }, { "X-API-Key": "wrong-key" })).status).toBe(401);
    expect((await bookingRequest({ slot_id: "s1", name: "", email: "ada@example.com" })).status).toBe(400);
    expect((await bookingRequest({ slot_id: "missing", name: "Ada", email: "ada@example.com" })).status).toBe(404);

    await reset(new Request(origin + "/reset", {
      method: "POST",
      headers,
      body: JSON.stringify({ slots: [{ id: "past", provider: "Dr Ade", start: past(60), end: past(30) }] }),
    }));
    expect((await bookingRequest({ slot_id: "past", name: "Ada", email: "ada@example.com" })).status).toBe(400);

    await resetSlots();
    const created = await bookingRequest({ slot_id: "s1", name: " Ada ", email: " ADA@EXAMPLE.COM " });
    expect(created.status).toBe(201);
    const booking = await created.json();
    expect(booking).toMatchObject({ slot_id: "s1", name: "Ada", email: "ada@example.com", status: "confirmed" });

    const slots = await getSlots(new Request(origin + "/slots", { headers: { "X-API-Key": apiKey } }));
    expect((await slots.json()).slots.find((slot: { id: string }) => slot.id === "s1").available).toBe(false);
    expect((await getBooking(new Request(origin + "/bookings/" + booking.id, { headers: { "X-API-Key": apiKey } }), idContext(booking.id))).status).toBe(200);
    expect((await getBooking(new Request(origin + "/bookings/not-a-uuid", { headers: { "X-API-Key": apiKey } }), idContext("not-a-uuid"))).status).toBe(404);

    const cancelled = await deleteBooking(new Request(origin + "/bookings/" + booking.id, { method: "DELETE", headers: { "X-API-Key": apiKey } }), idContext(booking.id));
    expect((await cancelled.json()).status).toBe("cancelled");
    expect((await deleteBooking(new Request(origin + "/bookings/" + booking.id, { method: "DELETE", headers: { "X-API-Key": apiKey } }), idContext(booking.id))).status).toBe(409);
    const missingId = "8a8f642d-396a-40e6-922f-9b7ae369dc68";
    expect((await deleteBooking(new Request(origin + "/bookings/" + missingId, { method: "DELETE", headers: { "X-API-Key": apiKey } }), idContext(missingId))).status).toBe(404);
    expect((await bookingRequest({ slot_id: "s1", name: "Bola", email: "bola@example.com" })).status).toBe(201);
  });

  it("serializes same-slot races with the database unique index", async () => {
    const race = await Promise.all(Array.from(
      { length: 6 },
      (_, index) => bookingRequest({ slot_id: "s1", name: "Patient " + String(index), email: "race-" + String(index) + "@example.com" }),
    ));
    expect(race.filter((response) => response.status === 201)).toHaveLength(1);
    expect(race.filter((response) => response.status === 409)).toHaveLength(5);
  });
});

describe("idempotency and booking history", () => {
  it("replays an identical canonical body concurrently and rejects a key reused for another body", async () => {
    const key = "same-request";
    const direct = await createBookingService({ slot_id: "s3", name: "Service", email: "service@example.com" }, "direct-idempotency");
    expect(direct.status).toBe(201);
    const [directFirst, directReplay] = await Promise.all([
      createBookingService({ slot_id: "s2", name: "Concurrent", email: "concurrent@example.com" }, "direct-concurrent-idempotency"),
      createBookingService({ email: "concurrent@example.com", name: "Concurrent", slot_id: "s2" }, "direct-concurrent-idempotency"),
    ]);
    expect(directFirst.status).toBe(201);
    expect(directReplay.status).toBe(201);
    expect(directReplay.body.id).toBe(directFirst.body.id);
    const [first, replay] = await Promise.all([
      bookingRequest({ slot_id: "s1", name: "Ada", email: "ada@example.com" }, { "Idempotency-Key": key }),
      bookingRequest({ email: "ada@example.com", name: "Ada", slot_id: "s1" }, { "Idempotency-Key": key }),
    ]);
    expect(first.status).toBe(201);
    expect(replay.status).toBe(201);
    expect((await replay.json()).id).toBe((await first.json()).id);
    expect((await bookingRequest({ slot_id: "s2", name: "Ada", email: "ada@example.com" }, { "Idempotency-Key": key })).status).toBe(422);
  });

  it("uses case-insensitive matching, strict query errors, and oldest-first pagination", async () => {
    for (const slotId of ["s1", "s2", "s3"]) {
      expect((await bookingRequest({ slot_id: slotId, name: "Ada", email: "pages@example.com" })).status).toBe(201);
    }
    expect((await getBookings(new Request(origin + "/bookings", { headers: { "X-API-Key": apiKey } }))).status).toBe(400);
    expect((await getBookings(new Request(origin + "/bookings?email=pages@example.com&limit=1.5", { headers: { "X-API-Key": apiKey } }))).status).toBe(400);
    expect((await getBookings(new Request(origin + "/bookings?email=pages@example.com&cursor=bad", { headers: { "X-API-Key": apiKey } }))).status).toBe(400);

    const firstPage = await getBookings(new Request(origin + "/bookings?email=PAGES%40EXAMPLE.COM&limit=2", { headers: { "X-API-Key": apiKey } }));
    const page = await firstPage.json();
    expect(page.bookings).toHaveLength(2);
    expect(page.next_cursor).toEqual(expect.any(String));
    const lastPage = await getBookings(new Request(origin + "/bookings?email=pages@example.com&limit=2&cursor=" + encodeURIComponent(page.next_cursor), { headers: { "X-API-Key": apiKey } }));
    const last = await lastPage.json();
    expect(last.bookings).toHaveLength(1);
    expect(last.next_cursor).toBeNull();
  });
});

describe("per-email rate limiter", () => {
  it("counts failed attempts, isolates other emails, retries in whole seconds, and resets after the window", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await bookingRequest({ slot_id: "missing", name: "Ada", email: "limited@example.com" })).status).toBe(404);
    }
    const limited = await bookingRequest({ slot_id: "missing", name: "Ada", email: "limited@example.com" });
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect((await bookingRequest({ slot_id: "missing", name: "Bola", email: "other@example.com" })).status).toBe(404);

    await testSql.unsafe("UPDATE booking_rate_limits SET window_started_at = now() - interval '61 seconds' WHERE email = 'limited@example.com'");
    expect((await bookingRequest({ slot_id: "missing", name: "Ada", email: "limited@example.com" })).status).toBe(404);

    const parallel = await Promise.all(Array.from(
      { length: 6 },
      () => bookingRequest({ slot_id: "missing", name: "Parallel", email: "parallel-limit@example.com" }),
    ));
    expect(parallel.filter((response) => response.status === 404)).toHaveLength(5);
    expect(parallel.filter((response) => response.status === 429)).toHaveLength(1);
  });
});
