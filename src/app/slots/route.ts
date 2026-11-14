import { json, requireApiKey, unexpectedError } from "@/lib/api";
import { listSlots } from "@/lib/booking-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = requireApiKey(request);
  if (unauthorized) return unauthorized;

  try {
    const provider = new URL(request.url).searchParams.get("provider");
    return json({ slots: await listSlots(provider) });
  } catch {
    return unexpectedError();
  }
}
