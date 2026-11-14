import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor } from "@/lib/cursor";
import { bookingInputSchema, candidateRateLimitEmail, resetInputSchema } from "@/lib/validation";

describe("cursor", () => {
  it("round-trips a valid opaque cursor", () => {
    const cursor = encodeCursor({ created_at: "2027-01-01T00:00:00.000Z", id: "f4c6f16e-1d42-4545-8f42-27893d7d2b8e" });
    expect(decodeCursor(cursor)).toEqual({ created_at: "2027-01-01T00:00:00.000Z", id: "f4c6f16e-1d42-4545-8f42-27893d7d2b8e" });
  });

  it("rejects malformed cursor text", () => {
    expect(decodeCursor("not-a-cursor")).toBeNull();
  });
});

describe("contract validation", () => {
  it("trims names and lowercases email before storage", () => {
    expect(bookingInputSchema.parse({ slot_id: " s1 ", name: " Ada Obi ", email: " ADA@EXAMPLE.COM " })).toEqual({
      slot_id: "s1", name: "Ada Obi", email: "ada@example.com",
    });
  });

  it("allows past reset slots but rejects illogical slot ranges", () => {
    expect(resetInputSchema.safeParse({ slots: [{ id: "past", provider: "Dr Ade", start: "2000-01-01T09:00:00Z", end: "2000-01-01T09:30:00Z" }] }).success).toBe(true);
    expect(resetInputSchema.safeParse({ slots: [{ id: "bad", provider: "Dr Ade", start: "2030-01-01T09:00:00Z", end: "2030-01-01T09:00:00Z" }] }).success).toBe(false);
  });

  it("uses a safe normalized bucket for supplied non-empty emails", () => {
    expect(candidateRateLimitEmail(" Ada@Example.COM ")).toBe("ada@example.com");
    expect(candidateRateLimitEmail(" ")).toBeNull();
    expect(candidateRateLimitEmail(undefined)).toBeNull();
  });
});
