-- ==============================================================================
-- COLLEGE ROOM BOOKING - OVERRIDE REQUESTS MIGRATION
-- Compatible with Supabase PostgreSQL (Paste directly into Supabase SQL Editor)
-- ==============================================================================

-- 1. Create Override Requests Table
CREATE TABLE IF NOT EXISTS public.override_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL,
  priority_reason TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

  -- Ensure valid time range
  CONSTRAINT valid_override_time_range CHECK (end_time > start_time)
);

-- Indexes for efficient querying and admin filtering
CREATE INDEX IF NOT EXISTS idx_override_requests_room_id ON public.override_requests(room_id);
CREATE INDEX IF NOT EXISTS idx_override_requests_requester_id ON public.override_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_override_requests_status ON public.override_requests(status);
CREATE INDEX IF NOT EXISTS idx_override_requests_created_at ON public.override_requests(created_at DESC);

-- ------------------------------------------------------------------------------
-- 2. Row Level Security (RLS) Policies
-- ------------------------------------------------------------------------------
ALTER TABLE public.override_requests ENABLE ROW LEVEL SECURITY;

-- Approved users can view their own requests; Approved admins can view all requests
CREATE POLICY "override_requests_select_policy"
  ON public.override_requests FOR SELECT
  TO authenticated
  USING (requester_id = auth.uid() OR public.is_admin());

-- Approved users can insert their own override requests
CREATE POLICY "override_requests_insert_policy"
  ON public.override_requests FOR INSERT
  TO authenticated
  WITH CHECK (public.is_approved() AND requester_id = auth.uid());

-- Only approved admins can update override requests (e.g. approve or reject)
CREATE POLICY "override_requests_update_policy"
  ON public.override_requests FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Approved admins or the requester (if still pending) can delete requests
CREATE POLICY "override_requests_delete_policy"
  ON public.override_requests FOR DELETE
  TO authenticated
  USING (public.is_admin() OR (requester_id = auth.uid() AND status = 'pending'));

-- ------------------------------------------------------------------------------
-- 3. Atomic Admin Override Approval RPC Function
-- ------------------------------------------------------------------------------
-- Atomically clears conflicting booking(s), reserves the room for the requester,
-- and updates the override request status in a single safe database transaction.
CREATE OR REPLACE FUNCTION public.approve_override_request(req_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.override_requests%ROWTYPE;
  v_deleted_count INT;
  v_new_booking_id UUID;
BEGIN
  -- 1. Security Check: verify the caller is an approved admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only approved administrators can approve override requests.';
  END IF;

  -- 2. Fetch the target override request
  SELECT * INTO v_request
  FROM public.override_requests
  WHERE id = req_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Override request not found.';
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'This override request has already been processed (status: %).', v_request.status;
  END IF;

  -- 3. Atomically remove any overlapping booking(s) for that room
  DELETE FROM public.bookings
  WHERE room_id = v_request.room_id
    AND tstzrange(start_time, end_time) && tstzrange(v_request.start_time, v_request.end_time);
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  -- 4. Create the new booking for the requester
  INSERT INTO public.bookings (room_id, user_id, purpose, start_time, end_time, created_at)
  VALUES (
    v_request.room_id,
    v_request.requester_id,
    v_request.purpose || ' [Admin Override: ' || v_request.priority_reason || ']',
    v_request.start_time,
    v_request.end_time,
    timezone('utc'::text, now())
  )
  RETURNING id INTO v_new_booking_id;

  -- 5. Mark the override request as approved
  UPDATE public.override_requests
  SET status = 'approved'
  WHERE id = req_id;

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', v_new_booking_id,
    'overridden_bookings_count', v_deleted_count
  );
END;
$$;
