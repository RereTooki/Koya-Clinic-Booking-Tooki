import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export type ApiHeaders = Record<string, string>;

export function json(body: unknown, status = 200, headers?: ApiHeaders): NextResponse {
  return NextResponse.json(body, { status, headers });
}

export function apiError(status: number, error: string, headers?: ApiHeaders): NextResponse {
  return json({ error }, status, headers);
}

/** Returns a JSON 401 response when the request cannot be authenticated. */
export function requireApiKey(request: Request): NextResponse | null {
  const configuredKey = process.env.KOYA_API_KEY;
  const requestKey = request.headers.get("x-api-key");

  if (!configuredKey || !requestKey) return apiError(401, "unauthorized");

  const expected = Buffer.from(configuredKey);
  const actual = Buffer.from(requestKey);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return apiError(401, "unauthorized");
  }

  return null;
}

export async function readJson(request: Request): Promise<{ value: unknown } | { error: NextResponse }> {
  try {
    return { value: await request.json() };
  } catch {
    return { error: apiError(400, "invalid JSON body") };
  }
}

export function unexpectedError(): NextResponse {
  // Deliberately avoid exposing database or implementation details.
  return apiError(500, "internal server error");
}
