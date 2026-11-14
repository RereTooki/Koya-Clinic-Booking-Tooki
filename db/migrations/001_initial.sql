BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS slots (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (length(btrim(provider)) > 0),
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS slots_start_at_id_idx ON slots (start_at, id);
CREATE INDEX IF NOT EXISTS slots_provider_start_at_id_idx ON slots (provider, start_at, id);

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id TEXT NOT NULL REFERENCES slots(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (length(btrim(name)) > 0),
  email TEXT NOT NULL CHECK (email = lower(btrim(email))),
  status TEXT NOT NULL CHECK (status IN ('confirmed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS one_confirmed_booking_per_slot_idx
  ON bookings (slot_id)
  WHERE status = 'confirmed';
CREATE INDEX IF NOT EXISTS bookings_email_created_id_idx ON bookings (email, created_at, id);

CREATE TABLE IF NOT EXISTS idempotency_records (
  idempotency_key TEXT PRIMARY KEY,
  body_fingerprint TEXT NOT NULL,
  response_status INTEGER NOT NULL CHECK (response_status BETWEEN 100 AND 599),
  response_body JSONB NOT NULL,
  response_headers JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS booking_rate_limits (
  email TEXT PRIMARY KEY,
  window_started_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL CHECK (attempts >= 0 AND attempts <= 5)
);

COMMIT;
