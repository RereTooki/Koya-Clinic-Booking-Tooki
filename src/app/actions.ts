"use server";

import "server-only";
import { randomUUID } from "node:crypto";
import type { Booking, Slot } from "@/lib/types";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

function baseUrl(): string {
  return (process.env.APP_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
}

function apiKey(): string | null {
  return process.env.KOYA_API_KEY || null;
}

async function callApi<T>(path: string, init?: RequestInit): Promise<ActionResult<T>> {
  const key = apiKey();
  if (!key) return { ok: false, error: "The booking service is not configured." };

  try {
    const response = await fetch(`${baseUrl()}${path}`, {
      ...init,
      cache: "no-store",
      headers: { "X-API-Key": key, ...(init?.headers ?? {}) },
    });
    const body: unknown = await response.json();
    if (!response.ok) {
      const message = body && typeof body === "object" && "error" in body ? (body as { error?: unknown }).error : undefined;
      return { ok: false, error: typeof message === "string" ? message : "We could not complete that request." };
    }
    return { ok: true, data: body as T };
  } catch {
    return { ok: false, error: "The booking service is unavailable. Please try again." };
  }
}

export async function loadSlotsAction(provider?: string): Promise<ActionResult<{ slots: Slot[] }>> {
  const query = provider === undefined ? "" : `?provider=${encodeURIComponent(provider)}`;
  return callApi<{ slots: Slot[] }>(`/slots${query}`);
}

export async function createBookingAction(input: {
  slot_id: string;
  name: string;
  email: string;
}): Promise<ActionResult<Booking>> {
  return callApi<Booking>("/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID() },
    body: JSON.stringify(input),
  });
}

export async function lookupBookingsAction(
  email: string,
  cursor?: string,
): Promise<ActionResult<{ bookings: Booking[]; next_cursor: string | null }>> {
  const query = new URLSearchParams({ email, limit: "10" });
  if (cursor) query.set("cursor", cursor);
  return callApi<{ bookings: Booking[]; next_cursor: string | null }>(`/bookings?${query.toString()}`);
}

export async function cancelBookingAction(id: string): Promise<ActionResult<Booking>> {
  return callApi<Booking>(`/bookings/${encodeURIComponent(id)}`, { method: "DELETE" });
}
