export type BookingStatus = "confirmed" | "cancelled";

export type Slot = {
  id: string;
  provider: string;
  start: string;
  end: string;
  available: boolean;
};

export type Booking = {
  id: string;
  slot_id: string;
  name: string;
  email: string;
  status: BookingStatus;
  created_at: string;
};
