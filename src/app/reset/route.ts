import { apiError, json, readJson, requireApiKey, unexpectedError } from "@/lib/api";
import { resetDatabase } from "@/lib/booking-service";
import { resetInputSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const unauthorized = requireApiKey(request);
  if (unauthorized) return unauthorized;

  const parsedBody = await readJson(request);
  if ("error" in parsedBody) return parsedBody.error;
  const parsed = resetInputSchema.safeParse(parsedBody.value);
  if (!parsed.success) return apiError(400, "invalid reset body");

  try {
    await resetDatabase(parsed.data.slots);
    return json({ ok: true });
  } catch {
    return unexpectedError();
  }
}
