-- ═══════════════════════════════════════════════════════════════════
-- Field Tracking v2 — Phase 1 hardening
--
-- Builds on supabase_tracking_schema.sql (which created the base tables
-- with the column names the mobile app actually uses: name/address/
-- contact_phone/lat/lng).
--
-- Adds:
--   • accuracy_m + is_mock columns (for fraud detection)
--   • lead_target_daily on employees
--   • verification fields on society_data (Phase 2 prep)
--   • explicit, idempotent RLS policies that work even if
--     `employees_full_access` from supabase_final_fix.sql is absent
--   • supporting indexes
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Ensure base tables exist (no-op if already created) ────────
CREATE TABLE IF NOT EXISTS public.employee_location_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    lat NUMERIC,
    lng NUMERIC,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.society_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    contact_person TEXT,
    contact_phone TEXT,
    number_of_flats INTEGER,
    status TEXT DEFAULT 'Pending',
    lat NUMERIC,
    lng NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. Tracking columns on employees ──────────────────────────────
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS current_lat NUMERIC,
  ADD COLUMN IF NOT EXISTS current_lng NUMERIC,
  ADD COLUMN IF NOT EXISTS last_location_update TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lead_target_daily INTEGER DEFAULT 15;

-- ── 3. Fraud-detection columns on history + visits ────────────────
ALTER TABLE public.employee_location_history
  ADD COLUMN IF NOT EXISTS accuracy_m NUMERIC,
  ADD COLUMN IF NOT EXISTS is_mock BOOLEAN DEFAULT FALSE;

ALTER TABLE public.society_data
  ADD COLUMN IF NOT EXISTS accuracy_m NUMERIC,
  ADD COLUMN IF NOT EXISTS is_mock BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_notes TEXT;

-- ── 4. Indexes for the dashboards ─────────────────────────────────
CREATE INDEX IF NOT EXISTS employee_location_history_emp_ts_idx
  ON public.employee_location_history (employee_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS society_data_emp_created_idx
  ON public.society_data (employee_id, created_at DESC);

CREATE INDEX IF NOT EXISTS society_data_verification_idx
  ON public.society_data (verification_status)
  WHERE verification_status = 'pending';

-- ── 5. Row Level Security ─────────────────────────────────────────
ALTER TABLE public.employee_location_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.society_data              ENABLE ROW LEVEL SECURITY;

-- 5a. Location history: any authenticated user can read (admin map +
-- employee self-view). Employees can only insert rows for themselves.
DROP POLICY IF EXISTS "auth_all_location_history"           ON public.employee_location_history;
DROP POLICY IF EXISTS "loc_history_select_authenticated"    ON public.employee_location_history;
DROP POLICY IF EXISTS "loc_history_insert_self"             ON public.employee_location_history;

CREATE POLICY "loc_history_select_authenticated"
  ON public.employee_location_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "loc_history_insert_self"
  ON public.employee_location_history FOR INSERT
  TO authenticated
  WITH CHECK (employee_id = auth.uid());

-- 5b. Society data: any authenticated user can read. Employees insert
-- their own visits. Updates allowed for the owner employee or any
-- authenticated admin (calling team uses verified_by/at/status).
DROP POLICY IF EXISTS "auth_all_society_data"          ON public.society_data;
DROP POLICY IF EXISTS "society_data_select_auth"       ON public.society_data;
DROP POLICY IF EXISTS "society_data_insert_self"       ON public.society_data;
DROP POLICY IF EXISTS "society_data_update_auth"       ON public.society_data;

CREATE POLICY "society_data_select_auth"
  ON public.society_data FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "society_data_insert_self"
  ON public.society_data FOR INSERT
  TO authenticated
  WITH CHECK (employee_id = auth.uid());

-- Calling team / admins update verification fields. App layer enforces
-- which roles can see the verification queue.
CREATE POLICY "society_data_update_auth"
  ON public.society_data FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 5c. Employees self-update of live coordinates.
-- supabase_final_fix.sql already sets a broad employees_full_access
-- policy. We add an explicit fallback so this works even if that
-- migration was never applied.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'employees'
      AND policyname = 'employees_self_update_location'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "employees_self_update_location"
        ON public.employees FOR UPDATE
        TO authenticated
        USING (id = auth.uid())
        WITH CHECK (id = auth.uid())
    $p$;
  END IF;
END $$;
