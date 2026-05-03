-- ═══════════════════════════════════════════════════════════════════
-- Field Tracking v5 — Phase 4 (shifts)
--
-- An `employee_shifts` row pairs a "Start Shift" action with an
-- "End Shift" action. Each row gives you attendance (did they work?),
-- working hours, start/end selfies (anti-ghost-attendance), and the
-- bounding times for building a route polyline.
--
-- At most one shift per employee may be open at a time (ended_at IS NULL).
-- Enforced with a partial unique index.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.employee_shifts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,

  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at      TIMESTAMPTZ,

  start_lat     NUMERIC,
  start_lng     NUMERIC,
  start_selfie_url TEXT,

  end_lat       NUMERIC,
  end_lng       NUMERIC,
  end_selfie_url   TEXT,

  -- Cached aggregates (updated on end). We don't rely on computing from
  -- employee_location_history every request — that'd be slow at scale.
  duration_min  INTEGER,
  distance_km   NUMERIC,
  visit_count   INTEGER DEFAULT 0,

  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one "open" shift per employee at a time.
CREATE UNIQUE INDEX IF NOT EXISTS employee_shifts_one_open_idx
  ON public.employee_shifts (employee_id)
  WHERE ended_at IS NULL;

CREATE INDEX IF NOT EXISTS employee_shifts_emp_started_idx
  ON public.employee_shifts (employee_id, started_at DESC);

ALTER TABLE public.employee_shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shifts_select_auth"  ON public.employee_shifts;
DROP POLICY IF EXISTS "shifts_insert_self"  ON public.employee_shifts;
DROP POLICY IF EXISTS "shifts_update_self"  ON public.employee_shifts;

-- Admin map / employees page needs to read all.
CREATE POLICY "shifts_select_auth"
  ON public.employee_shifts FOR SELECT
  TO authenticated USING (true);

-- Employees can only open/close their own shifts.
CREATE POLICY "shifts_insert_self"
  ON public.employee_shifts FOR INSERT
  TO authenticated
  WITH CHECK (employee_id = auth.uid());

CREATE POLICY "shifts_update_self"
  ON public.employee_shifts FOR UPDATE
  TO authenticated
  USING (employee_id = auth.uid())
  WITH CHECK (employee_id = auth.uid());
