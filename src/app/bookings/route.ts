import { z } from "zod";
import { apiError, json, readJson, requireApiKey, unexpectedError } from "@/lib/api";
import { createBooking, listBookings } from "@/lib/booking-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const unauthorized = requireApiKey(request);
  if (unauthorized) return unauthorized;

  const parsedBody = await readJson(request);
  if ("error" in parsedBody) return parsedBody.error;

  try {
    const response = await createBooking(parsedBody.value, request.headers.get("idempotency-key"));
    return json(response.body, response.status, response.headers);
  } catch {
    return unexpectedError();
  }
}

export async function GET(request: Request) {
  const unauthorized = requireApiKey(request);
  if (unauthorized) return unauthorized;

  const url = new URL(request.url);
  const emailResult = z.string().trim().toLowerCase().email().safeParse(url.searchParams.get("email"));
  if (!emailResult.success) return apiError(400, "a valid email query parameter is required");

  const rawLimit = url.searchParams.get("limit");
  let limit = 10;
  if (rawLimit !== null) {
    if (!/^[1-9]\d*$/.test(rawLimit)) return apiError(400, "limit must be an integer between 1 and 50");
    limit = Number(rawLimit);
    if (limit < 1 || limit > 50) return apiError(400, "limit must be an integer between 1 and 50");
  }

  try {
    const response = await listBookings(emailResult.data, limit, url.searchParams.get("cursor"));
    if (!response) return apiError(400, "invalid cursor");
    return json(response);
  } catch {
    return unexpectedError();
  }
}
