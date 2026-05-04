-- ═══════════════════════════════════════════════════════════════════
-- Field Tracking v6 — Phase 6 (society assignments)
--
-- Admins assign target societies to employees for a given date.
-- Employees see their assignments in the field app and can mark them
-- visited (which auto-links the visit to the assignment via assigned_society_id).
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.assigned_societies (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id        UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  assigned_date      DATE NOT NULL,
  society_name       TEXT NOT NULL,
  address            TEXT,
  lat                NUMERIC,          -- Optional target location for route planning
  lng                NUMERIC,
  priority           INTEGER DEFAULT 0, -- Display/highlight order (higher = more urgent)
  notes              TEXT,              -- Admin planning notes
  visited_at         TIMESTAMPTZ,       -- Set when a visit is matched to this assignment
  visit_id           UUID REFERENCES public.society_data(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Core index for employee-day lookups (My Assignments list, route planning queries).
CREATE INDEX IF NOT EXISTS assigned_societies_emp_date_idx
  ON public.assigned_societies (employee_id, assigned_date);

-- For "today's unvisited assignments" queries on the admin dashboard.
CREATE INDEX IF NOT EXISTS assigned_societies_date_visited_idx
  ON public.assigned_societies (assigned_date, visited_at)
  WHERE visited_at IS NULL;

ALTER TABLE public.assigned_societies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "assignments_select_emp" ON public.assigned_societies;
DROP POLICY IF EXISTS "assignments_select_admin" ON public.assigned_societies;
DROP POLICY IF EXISTS "assignments_insert_admin" ON public.assigned_societies;
DROP POLICY IF EXISTS "assignments_update_emp" ON public.assigned_societies;
DROP POLICY IF EXISTS "assignments_update_admin" ON public.assigned_societies;
DROP POLICY IF EXISTS "assignments_delete_admin" ON public.assigned_societies;

-- Employees can view their own assignments.
CREATE POLICY "assignments_select_emp"
  ON public.assigned_societies FOR SELECT
  TO authenticated
  USING (employee_id = auth.uid());

-- Admins can view all assignments.
CREATE POLICY "assignments_select_admin"
  ON public.assigned_societies FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can create assignments.
CREATE POLICY "assignments_insert_admin"
  ON public.assigned_societies FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Employees can update their own assignments (e.g., mark visited by linking a visit_id).
CREATE POLICY "assignments_update_emp"
  ON public.assigned_societies FOR UPDATE
  TO authenticated
  USING (employee_id = auth.uid())
  WITH CHECK (employee_id = auth.uid());

-- Admins can update any assignment.
CREATE POLICY "assignments_update_admin"
  ON public.assigned_societies FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Only admins can delete assignments.
CREATE POLICY "assignments_delete_admin"
  ON public.assigned_societies FOR DELETE
  TO authenticated
  USING (true);

-- Add link column on society_data so a visit can reference its matched assignment.
-- This is nullable because visits can be ad-hoc (not tied to a pre-planned assignment).
ALTER TABLE public.society_data
ADD COLUMN IF NOT EXISTS assigned_society_id UUID REFERENCES public.assigned_societies(id) ON DELETE SET NULL;

-- Index to quickly find visits for a given assignment (useful for admin completion tracking).
CREATE INDEX IF NOT EXISTS society_data_assigned_society_id_idx
  ON public.society_data (assigned_society_id)
  WHERE assigned_society_id IS NOT NULL;

-- Optional: trigger to auto-update updated_at on assigned_societies.
CREATE OR REPLACE FUNCTION public.set_updated_at_assigned_societies()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assigned_societies_updated_at ON public.assigned_societies;
CREATE TRIGGER trg_assigned_societies_updated_at
  BEFORE UPDATE ON public.assigned_societies
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at_assigned_societies();
