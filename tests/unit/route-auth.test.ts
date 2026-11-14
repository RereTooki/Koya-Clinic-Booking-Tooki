import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as reset } from "@/app/reset/route";
import { GET as slots } from "@/app/slots/route";
import { GET as listBookings, POST as createBooking } from "@/app/bookings/route";
import { DELETE as cancelBooking, GET as getBooking } from "@/app/bookings/[id]/route";
import { readJson, requireApiKey } from "@/lib/api";

const origin = "http://localhost:3000";
const idContext = { params: Promise.resolve({ id: "a1b2c3d4-e5f6-4789-8abc-def012345678" }) };
let originalKey: string | undefined;

beforeEach(() => {
  originalKey = process.env.KOYA_API_KEY;
  process.env.KOYA_API_KEY = "test-key";
});

afterEach(() => {
  if (originalKey === undefined) delete process.env.KOYA_API_KEY;
  else process.env.KOYA_API_KEY = originalKey;
});

describe("public route API-key enforcement", () => {
  it("returns the exact safe 401 shape for every contract route before database access", async () => {
    const responses = await Promise.all([
      reset(new Request(`${origin}/reset`, { method: "POST" })),
      slots(new Request(`${origin}/slots`)),
      createBooking(new Request(`${origin}/bookings`, { method: "POST" })),
      listBookings(new Request(`${origin}/bookings?email=ada@example.com`)),
      getBooking(new Request(`${origin}/bookings/${await idContext.params.then((params) => params.id)}`), idContext),
      cancelBooking(new Request(`${origin}/bookings/${await idContext.params.then((params) => params.id)}`, { method: "DELETE" }), idContext),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
    }
  });

  it("does not accept an incorrect key", async () => {
    const response = await slots(new Request(`${origin}/slots`, { headers: { "X-API-Key": "wrong-key" } }));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
  });

  it("fails closed when the server key is absent, even if a request sends a key", async () => {
    delete process.env.KOYA_API_KEY;
    const response = requireApiKey(new Request(`${origin}/slots`, { headers: { "X-API-Key": "anything" } }));
    expect(response?.status).toBe(401);
    await expect(response?.json()).resolves.toEqual({ error: "unauthorized" });
  });

  it("returns JSON-only 400 responses for malformed request bodies before database access", async () => {
    const response = await reset(new Request(`${origin}/reset`, {
      method: "POST",
      headers: { "X-API-Key": "test-key", "Content-Type": "application/json" },
      body: "{",
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid JSON body" });

    const parsed = await readJson(new Request(`${origin}/bookings`, { method: "POST", body: "{" }));
    expect("error" in parsed).toBe(true);
  });
});
