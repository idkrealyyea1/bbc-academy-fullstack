-- 004_booking_requests.sql — BBC English Academy
-- Apply after 001-003. Booking requests are anonymous: a student applies via
-- booking.html BEFORE having an account, so the API must accept them without
-- a JWT. The admin later confirms the request and creates the account.
-- The API writes via its Postgres connection (DATABASE_URL); this table is
-- not written to directly from the browser, so RLS is enabled with no public
-- policies — direct Supabase client access is denied by default.
DO $$ BEGIN
  CREATE TYPE booking_request_status AS ENUM ('pending', 'confirmed', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS booking_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  course TEXT,
  source TEXT,
  message TEXT,
  status booking_request_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE booking_requests ENABLE ROW LEVEL SECURITY;
