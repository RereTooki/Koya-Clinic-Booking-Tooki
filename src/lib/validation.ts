import { z } from "zod";

export const bookingInputSchema = z.object({
  slot_id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  email: z.string().trim().toLowerCase().email(),
});

const timestamp = z.string().refine((value) => !Number.isNaN(Date.parse(value)), "invalid timestamp");

export const resetInputSchema = z
  .object({
    slots: z.array(
      z
        .object({
          id: z.string().trim().min(1),
          provider: z.string().trim().min(1),
          start: timestamp,
          end: timestamp,
        })
        .strict(),
    ),
  })
  .strict()
  .superRefine((value, context) => {
    const seen = new Set<string>();
    value.slots.forEach((slot, index) => {
      if (seen.has(slot.id)) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["slots", index, "id"], message: "duplicate slot id" });
      }
      seen.add(slot.id);
      if (Date.parse(slot.end) <= Date.parse(slot.start)) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["slots", index, "end"], message: "end must be after start" });
      }
    });
  });

export function candidateRateLimitEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}
