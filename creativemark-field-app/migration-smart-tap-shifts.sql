-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: Smart Tap AI + Shift Diary + Selfie Cleanup
-- Run in: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. EMPLOYEE_SHIFTS: Add diary columns ──────────────────────────────────
ALTER TABLE public.employee_shifts ADD COLUMN IF NOT EXISTS planned_work TEXT;
ALTER TABLE public.employee_shifts ADD COLUMN IF NOT EXISTS no_work_flag BOOLEAN DEFAULT FALSE;
ALTER TABLE public.employee_shifts ADD COLUMN IF NOT EXISTS work_summary TEXT;

-- ─── 2. EMPLOYEES: Add project assignment ───────────────────────────────────
-- Values: 'society_one', 'smart_tap_ai', 'both'
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS project TEXT DEFAULT 'society_one';

-- ─── 3. SHOP_VISITS: Smart Tap AI lead/shop form ───────────────────────────
CREATE TABLE IF NOT EXISTS public.shop_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  person_name TEXT NOT NULL,
  mobile TEXT,
  shop_name TEXT,
  interest_status TEXT DEFAULT 'not_contacted',
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  accuracy_m DOUBLE PRECISION,
  selfie_url TEXT,
  shop_photo_url TEXT,
  next_call_date DATE,
  notes TEXT,
  google_map_link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shop_visits_employee_created
  ON public.shop_visits(employee_id, created_at DESC);

-- ─── 4. RLS for shop_visits ─────────────────────────────────────────────────
ALTER TABLE public.shop_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shop_visits_insert_own" ON public.shop_visits;
CREATE POLICY "shop_visits_insert_own" ON public.shop_visits
  FOR INSERT WITH CHECK (auth.uid() = employee_id);

DROP POLICY IF EXISTS "shop_visits_select_own" ON public.shop_visits;
CREATE POLICY "shop_visits_select_own" ON public.shop_visits
  FOR SELECT USING (auth.uid() = employee_id);

DROP POLICY IF EXISTS "shop_visits_update_own" ON public.shop_visits;
CREATE POLICY "shop_visits_update_own" ON public.shop_visits
  FOR UPDATE USING (auth.uid() = employee_id);

DROP POLICY IF EXISTS "shop_visits_admin_read_all" ON public.shop_visits;
CREATE POLICY "shop_visits_admin_read_all" ON public.shop_visits
  FOR SELECT USING (auth.role() = 'authenticated');

-- ─── 5. SHIFT SELFIE AUTO-CLEANUP (2 days) ─────────────────────────────────
-- This function returns storage paths to delete, then nulls the URLs.
-- Call it from a Supabase Edge Function on a daily cron schedule.
CREATE OR REPLACE FUNCTION public.cleanup_old_shift_selfies()
RETURNS TABLE(storage_path TEXT) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Return paths that need deletion from storage bucket
  RETURN QUERY
  SELECT regexp_replace(url, '^.*/storage/v1/object/public/field-evidence/', '') AS storage_path
  FROM (
    SELECT start_selfie_url AS url FROM public.employee_shifts
    WHERE start_selfie_url IS NOT NULL AND started_at < NOW() - INTERVAL '2 days'
    UNION ALL
    SELECT end_selfie_url AS url FROM public.employee_shifts
    WHERE end_selfie_url IS NOT NULL AND started_at < NOW() - INTERVAL '2 days'
  ) urls
  WHERE url IS NOT NULL;

  -- Null out the URLs so they aren't returned again
  UPDATE public.employee_shifts
  SET start_selfie_url = NULL, end_selfie_url = NULL
  WHERE (start_selfie_url IS NOT NULL OR end_selfie_url IS NOT NULL)
    AND started_at < NOW() - INTERVAL '2 days';
END;
$$;

-- ─── 6. GRANT execute to service_role for Edge Function ─────────────────────
GRANT EXECUTE ON FUNCTION public.cleanup_old_shift_selfies() TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ✅ DONE
-- Tables: shop_visits created, employee_shifts + employees updated
-- Selfie cleanup: call SELECT * FROM cleanup_old_shift_selfies() daily
-- ═══════════════════════════════════════════════════════════════════════════════
