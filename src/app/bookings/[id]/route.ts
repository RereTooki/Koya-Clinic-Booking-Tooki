import { z } from "zod";
import { apiError, json, requireApiKey, unexpectedError } from "@/lib/api";
import { cancelBooking, getBooking } from "@/lib/booking-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

function validId(id: string): boolean {
  return z.string().uuid().safeParse(id).success;
}

export async function GET(request: Request, context: RouteContext) {
  const unauthorized = requireApiKey(request);
  if (unauthorized) return unauthorized;
  const { id } = await context.params;
  if (!validId(id)) return apiError(404, "booking not found");

  try {
    const booking = await getBooking(id);
    return booking ? json(booking) : apiError(404, "booking not found");
  } catch {
    return unexpectedError();
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const unauthorized = requireApiKey(request);
  if (unauthorized) return unauthorized;
  const { id } = await context.params;
  if (!validId(id)) return apiError(404, "booking not found");

  try {
    const response = await cancelBooking(id);
    return json(response.body, response.status, response.headers);
  } catch {
    return unexpectedError();
  }
}
