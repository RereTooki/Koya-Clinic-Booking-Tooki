import { describe, expect, it } from "vitest";
import { bodyFingerprint, canonicalJson } from "@/lib/canonical-json";

describe("canonical JSON", () => {
  it("sorts object keys recursively without changing array order", () => {
    expect(canonicalJson({ z: [{ b: 2, a: 1 }], a: true })).toBe('{"a":true,"z":[{"a":1,"b":2}]}');
  });

  it("gives semantically identical object bodies the same fingerprint", () => {
    expect(bodyFingerprint({ email: "ada@example.com", name: "Ada", slot_id: "s1" })).toBe(
      bodyFingerprint({ slot_id: "s1", name: "Ada", email: "ada@example.com" }),
    );
  });
});
