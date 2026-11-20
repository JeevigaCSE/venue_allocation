-- ==============================================================================
-- COLLEGE DEPARTMENT & ROOM BOOKING SYSTEM - DATABASE SCHEMA
-- Compatible with Supabase PostgreSQL (paste directly into SQL Editor)
-- Updated: Uses `is_approved` BOOLEAN (default false) and `role` ('admin' | 'staff')
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ------------------------------------------------------------------------------
-- 2. Profiles Table (Linked to auth.users)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  designation TEXT,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  is_approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index for quick lookups on role, approval, and email
CREATE INDEX IF NOT EXISTS idx_profiles_role_approved ON public.profiles (role, is_approved);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (email);

-- Trigger Function: Automatically create profile on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, designation, role, is_approved, created_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'designation', ''),
    'staff',
    false,
    timezone('utc'::text, now())
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Attach trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 3. Departments Table & Initial Seed Data (9 Blocks)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_departments_display_order ON public.departments (display_order ASC);

-- Seed 9 initial department blocks
INSERT INTO public.departments (name, code, display_order)
VALUES
  ('Computer Science and Engineering', 'CSE', 1),
  ('Information Technology', 'IT', 2),
  ('Electronics and Communication Engineering', 'ECE', 3),
  ('Electrical and Electronics Engineering', 'EEE', 4),
  ('Artificial Intelligence and Data Science', 'ADS', 5),
  ('Civil Engineering', 'CIVIL', 6),
  ('Mechanical Engineering', 'MECH', 7),
  ('Auditorium', 'AUD', 8),
  ('Administrative Block', 'ADMIN', 9)
ON CONFLICT (code) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 4. Rooms Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Hall', 'Room', 'Lab')),
  capacity INTEGER NOT NULL DEFAULT 0 CHECK (capacity >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_rooms_department_id ON public.rooms (department_id);

-- ------------------------------------------------------------------------------
-- 5. Bookings Table (With Overlap Prevention & Range Validation)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  
  -- Ensures end time is strictly after start time
  CONSTRAINT valid_booking_time_range CHECK (end_time > start_time),
  
  -- GiST exclusion constraint: Prevents overlapping bookings for the same room
  CONSTRAINT no_overlapping_bookings EXCLUDE USING gist (
    room_id WITH =,
    tstzrange(start_time, end_time) WITH &&
  )
);

CREATE INDEX IF NOT EXISTS idx_bookings_room_time ON public.bookings (room_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON public.bookings (user_id);

-- ------------------------------------------------------------------------------
-- 6. Helper Security Functions (Avoid RLS Recursion)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_approved()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_approved = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin' AND is_approved = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Safety Trigger: Prevent non-admins from self-promoting role or approval status
CREATE OR REPLACE FUNCTION public.protect_profile_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT public.is_admin() THEN
    IF NEW.role <> OLD.role OR NEW.is_approved <> OLD.is_approved THEN
      RAISE EXCEPTION 'Only an approved administrator can modify roles or approval status.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_protect_profile_changes ON public.profiles;
CREATE TRIGGER trg_protect_profile_changes
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_changes();

-- ------------------------------------------------------------------------------
-- 7. Row Level Security (RLS) Configuration
-- ------------------------------------------------------------------------------

-- Enable RLS on all 4 tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- ====== PROFILES POLICIES ======
-- Users can read their own profile (even if pending) or approved users can view all profiles
CREATE POLICY "profiles_select_policy"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR public.is_approved());

-- Allow users to insert their own profile
CREATE POLICY "profiles_insert_policy"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Admins can update any profile; users can update their own profile (role/is_approved protected by trigger)
CREATE POLICY "profiles_update_policy"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin() OR auth.uid() = id)
  WITH CHECK (public.is_admin() OR auth.uid() = id);

-- Only Admins can delete profiles
CREATE POLICY "profiles_delete_policy"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ====== DEPARTMENTS POLICIES ======
-- Only approved users can view departments
CREATE POLICY "departments_select_policy"
  ON public.departments FOR SELECT
  TO authenticated
  USING (public.is_approved());

-- Only approved admins can insert/update/delete departments
CREATE POLICY "departments_insert_policy"
  ON public.departments FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "departments_update_policy"
  ON public.departments FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "departments_delete_policy"
  ON public.departments FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ====== ROOMS POLICIES ======
-- Only approved users can view rooms
CREATE POLICY "rooms_select_policy"
  ON public.rooms FOR SELECT
  TO authenticated
  USING (public.is_approved());

-- Only approved admins can insert/update/delete rooms
CREATE POLICY "rooms_insert_policy"
  ON public.rooms FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "rooms_update_policy"
  ON public.rooms FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "rooms_delete_policy"
  ON public.rooms FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ====== BOOKINGS POLICIES ======
-- Only approved users can view bookings
CREATE POLICY "bookings_select_policy"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (public.is_approved());

-- Only approved users can create bookings for themselves
CREATE POLICY "bookings_insert_policy"
  ON public.bookings FOR INSERT
  TO authenticated
  WITH CHECK (public.is_approved() AND auth.uid() = user_id);

-- Admins can update any booking; users can update their own bookings
CREATE POLICY "bookings_update_policy"
  ON public.bookings FOR UPDATE
  TO authenticated
  USING (public.is_admin() OR (public.is_approved() AND auth.uid() = user_id))
  WITH CHECK (public.is_admin() OR (public.is_approved() AND auth.uid() = user_id));

-- Staff can delete only their own bookings; Admins can delete any booking
CREATE POLICY "bookings_delete_policy"
  ON public.bookings FOR DELETE
  TO authenticated
  USING (public.is_admin() OR (public.is_approved() AND auth.uid() = user_id));

-- ==============================================================================
-- 8. FIRST ADMIN PROMOTION INSTRUCTION:
-- Run this one-line SQL command after signing up your first account in Supabase Auth:
--
-- UPDATE public.profiles SET role = 'admin', is_approved = true WHERE email = 'your-admin-email@college.edu';
-- ==============================================================================
