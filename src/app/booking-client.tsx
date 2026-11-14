"use client";

import { useMemo, useState, useTransition } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  MapPin,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import {
  cancelBookingAction,
  createBookingAction,
  loadSlotsAction,
  lookupBookingsAction,
} from "@/app/actions";
import type { Booking, Slot } from "@/lib/types";

type Props = { initialSlots: Slot[]; initialError?: string };

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function BookingClient({ initialSlots, initialError }: Props) {
  const [slots, setSlots] = useState(initialSlots);
  const [provider, setProvider] = useState("all");
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(
    initialError ?? null,
  );
  const [lookupEmail, setLookupEmail] = useState("");
  const [history, setHistory] = useState<Booking[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const providers = useMemo(
    () => [...new Set(slots.map((slot) => slot.provider))].sort(),
    [slots],
  );
  const shownSlots = useMemo(
    () =>
      slots.filter((slot) => provider === "all" || slot.provider === provider),
    [provider, slots],
  );

  const refreshSlots = () => {
    startTransition(async () => {
      const response = await loadSlotsAction();
      if (response.ok) setSlots(response.data.slots);
      else setBookingError(response.error);
    });
  };

  const submitBooking = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedSlot) return;
    const form = new FormData(event.currentTarget);
    setBookingError(null);
    setBooking(null);
    startTransition(async () => {
      const response = await createBookingAction({
        slot_id: selectedSlot.id,
        name: String(form.get("name") ?? ""),
        email: String(form.get("email") ?? ""),
      });
      if (response.ok) {
        setBooking(response.data);
        setSelectedSlot(null);
        refreshSlots();
      } else {
        setBookingError(response.error);
      }
    });
  };

  const lookup = (cursor?: string) => {
    setLookupError(null);
    startTransition(async () => {
      const response = await lookupBookingsAction(lookupEmail, cursor);
      if (response.ok) {
        setHistory((current) =>
          cursor
            ? [...current, ...response.data.bookings]
            : response.data.bookings,
        );
        setNextCursor(response.data.next_cursor);
      } else setLookupError(response.error);
    });
  };

  const submitLookup = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setHistory([]);
    setNextCursor(null);
    lookup();
  };

  const cancel = (id: string) => {
    setLookupError(null);
    startTransition(async () => {
      const response = await cancelBookingAction(id);
      if (response.ok) {
        setHistory((current) =>
          current.map((item) => (item.id === id ? response.data : item)),
        );
        refreshSlots();
      } else setLookupError(response.error);
    });
  };

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <header className="mb-10 flex flex-col justify-between gap-5 border-b border-teal-900/10 pb-8 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
            <ShieldCheck size={17} /> Koya Care
          </p>
          <h1 className="font-serif text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
            Book an appointment.
          </h1>
          <p className="mt-3 max-w-xl text-slate-600">
            Choose a clinician and an available time. We’ll confirm the
            appointment once it is booked.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-teal-50 px-4 py-2 text-sm font-medium text-teal-900">
          <MapPin size={16} /> Appointment booking
        </div>
      </header>

      <section
        aria-labelledby="slots-heading"
        className="grid gap-8 lg:grid-cols-[1.45fr_0.85fr]"
      >
        <div>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2
                id="slots-heading"
                className="text-2xl font-semibold text-slate-900"
              >
                Available appointments
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                All times are shown in your local time zone.
              </p>
            </div>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Clinician
              <select
                value={provider}
                onChange={(event) => setProvider(event.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-200"
              >
                <option value="all">All clinicians</option>
                {providers.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {bookingError && <Notice error message={bookingError} />}
          {booking && (
            <div
              role="status"
              className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950"
            >
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 size={19} /> Appointment confirmed.
              </div>
              <p className="mt-1 text-sm">
                Reference: <span className="font-mono">{booking.id}</span> ·{" "}
                {formatTime(
                  slots.find((slot) => slot.id === booking.slot_id)?.start ??
                    booking.created_at,
                )}
              </p>
            </div>
          )}

          <div aria-live="polite" className="grid gap-3 sm:grid-cols-2">
            {shownSlots.map((slot) => (
              <article
                key={slot.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-300 hover:shadow-soft"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {slot.provider}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                      <CalendarDays size={15} /> {formatTime(slot.start)}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                      <Clock3 size={15} /> Ends{" "}
                      {new Intl.DateTimeFormat(undefined, {
                        timeStyle: "short",
                      }).format(new Date(slot.end))}
                    </p>
                  </div>
                  <span
                    className={
                      slot.available
                        ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800"
                        : "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500"
                    }
                  >
                    {slot.available ? "Available" : "Booked"}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={!slot.available || isPending}
                  onClick={() => {
                    setSelectedSlot(slot);
                    setBookingError(null);
                  }}
                  className="mt-5 w-full rounded-lg bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white outline-none transition hover:bg-teal-900 focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {slot.available ? "Select time" : "Already booked"}
                </button>
              </article>
            ))}
          </div>
          {!shownSlots.length && (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-600">
              No appointments are available for this clinician. Choose another
              clinician or check back later.
            </div>
          )}
        </div>

        <aside className="h-fit rounded-2xl bg-slate-900 p-6 text-slate-50 shadow-soft">
          <h2 className="text-xl font-semibold">
            {selectedSlot ? "Appointment details" : "Select an appointment"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            {selectedSlot
              ? `${selectedSlot.provider} · ${formatTime(selectedSlot.start)}`
              : "Choose an available time to continue."}
          </p>
          {selectedSlot && (
            <form onSubmit={submitBooking} className="mt-6 grid gap-4">
              <label className="grid gap-1.5 text-sm font-medium">
                Full name
                <input
                  required
                  name="name"
                  autoComplete="name"
                  className="rounded-lg border border-slate-600 bg-white px-3 py-2.5 text-slate-950 outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-300"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Email address
                <input
                  required
                  type="email"
                  name="email"
                  autoComplete="email"
                  className="rounded-lg border border-slate-600 bg-white px-3 py-2.5 text-slate-950 outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-300"
                />
              </label>
              <button
                disabled={isPending}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-400 px-4 py-3 font-semibold text-slate-950 outline-none transition hover:bg-teal-300 focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-60"
              >
                {isPending && (
                  <LoaderCircle className="animate-spin" size={17} />
                )}{" "}
                Confirm booking
              </button>
              <button
                type="button"
                onClick={() => setSelectedSlot(null)}
                className="text-sm text-slate-300 underline underline-offset-4 hover:text-white"
              >
                Choose a different time
              </button>
            </form>
          )}
        </aside>
      </section>

      <section
        aria-labelledby="history-heading"
        className="mt-12 border-t border-slate-200 pt-10"
      >
        <div className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
          <div>
            <h2
              id="history-heading"
              className="text-2xl font-semibold text-slate-900"
            >
              Look up an appointment
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Enter the email address used for the booking to view its history
              or cancel a confirmed appointment.
            </p>
            <form onSubmit={submitLookup} className="mt-5 flex gap-2">
              <label className="sr-only" htmlFor="lookup-email">
                Booking email
              </label>
              <input
                id="lookup-email"
                value={lookupEmail}
                onChange={(event) => setLookupEmail(event.target.value)}
                required
                type="email"
                placeholder="name@example.com"
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-200"
              />
              <button
                disabled={isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
              >
                <Search size={16} /> Search
              </button>
            </form>
          </div>
          <div>
            {lookupError && <Notice error message={lookupError} />}
            {history.length > 0 && (
              <div className="grid gap-3">
                {history.map((item) => (
                  <article
                    key={item.id}
                    className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        Booking{" "}
                        <span className="font-mono text-xs font-normal text-slate-500">
                          {item.id}
                        </span>
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        Created {formatTime(item.created_at)} ·{" "}
                        <span
                          className={
                            item.status === "confirmed"
                              ? "font-medium text-emerald-700"
                              : "font-medium text-slate-500"
                          }
                        >
                          {item.status}
                        </span>
                      </p>
                    </div>
                    {item.status === "confirmed" && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => cancel(item.id)}
                        className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                      >
                        Cancel appointment
                      </button>
                    )}
                  </article>
                ))}
              </div>
            )}
            {history.length === 0 && !lookupError && (
              <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-600">
                Appointments booked with this email will appear here.
              </p>
            )}
            {nextCursor && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => lookup(nextCursor)}
                className="mt-4 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Load more
              </button>
            )}
          </div>
        </div>
      </section>

      <footer className="mt-12 border-t border-slate-200 pt-6 text-center text-sm text-slate-500">
        © 2026{" "}
        <a
          href="https://www.reretooki.com/"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-4 hover:text-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
        >
          Rerel&apos;Oluwa Tooki
        </a>
      </footer>
    </main>
  );
}

function Notice({ error, message }: { error?: boolean; message: string }) {
  return (
    <div
      role="alert"
      className={
        error
          ? "mb-4 flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"
          : "mb-4"
      }
    >
      <XCircle size={18} className="shrink-0" />
      {message}
    </div>
  );
}
