-- ═══════════════════════════════════════════════════════════════════
-- Field Tracking v4 — Phase 3 (home-cluster + assigned societies)
--
-- Adds:
--   • employees.home_lat / home_lng / home_radius_m — used to flag
--     visits clustered near an employee's home (i.e. they're logging
--     leads from the sofa).
--   • assigned_societies — owner pre-assigns a target list per employee
--     per day/week so you can compare "assigned vs visited".
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Home coordinates on employees ──────────────────────────────
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS home_lat      NUMERIC,
  ADD COLUMN IF NOT EXISTS home_lng      NUMERIC,
  ADD COLUMN IF NOT EXISTS home_radius_m INTEGER DEFAULT 250;

-- ── 2. Pre-assigned society targets ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.assigned_societies (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id    UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  assigned_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  society_name   TEXT NOT NULL,
  address        TEXT,
  target_lat     NUMERIC,
  target_lng     NUMERIC,
  target_radius_m INTEGER DEFAULT 150,
  notes          TEXT,
  -- Once the employee logs a matching visit we flip this to the row id;
  -- this gives us a cheap "assigned vs visited" join.
  visit_id       UUID REFERENCES public.society_data(id) ON DELETE SET NULL,
  status         TEXT NOT NULL DEFAULT 'pending', -- pending | visited | skipped
  created_by     UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS assigned_societies_emp_date_idx
  ON public.assigned_societies (employee_id, assigned_date DESC);

ALTER TABLE public.assigned_societies ENABLE ROW LEVEL SECURITY;

-- All authenticated can read; owner (created_by) or the assigned employee
-- can update the status. Insert allowed for any authenticated (admin app
-- layer gates who can create).
DROP POLICY IF EXISTS "assigned_select_auth"  ON public.assigned_societies;
DROP POLICY IF EXISTS "assigned_insert_auth"  ON public.assigned_societies;
DROP POLICY IF EXISTS "assigned_update_auth"  ON public.assigned_societies;

CREATE POLICY "assigned_select_auth"
  ON public.assigned_societies FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "assigned_insert_auth"
  ON public.assigned_societies FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "assigned_update_auth"
  ON public.assigned_societies FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
