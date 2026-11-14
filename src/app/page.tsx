import { BookingClient } from "@/app/booking-client";
import { loadSlotsAction } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function Home() {
  const result = await loadSlotsAction();
  if (result.ok) return <BookingClient initialSlots={result.data.slots} />;
  return <BookingClient initialSlots={[]} initialError={result.error} />;
}
