-- ============================================================================
-- CreativeMark Field App — VERIFY & FIX every table + column
-- Paste this into Supabase SQL Editor and run it.
-- It will CREATE missing tables, ADD missing columns, and REPORT status.
-- ============================================================================

-- ─── 1. EMPLOYEES ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.employees (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'Employee',
  custom_role TEXT,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  base_rate NUMERIC DEFAULT 0,
  salary NUMERIC DEFAULT 0,
  lead_target INTEGER DEFAULT 50,
  lead_target_daily INTEGER DEFAULT 15,
  status TEXT DEFAULT 'Active',
  current_lat DOUBLE PRECISION,
  current_lng DOUBLE PRECISION,
  last_location_update TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '';
  ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'Employee';
  ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS custom_role TEXT;
  ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS phone TEXT;
  ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS whatsapp TEXT;
  ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS email TEXT;
  ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS base_rate NUMERIC DEFAULT 0;
  ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS salary NUMERIC DEFAULT 0;
  ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS lead_target INTEGER DEFAULT 50;
  ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS lead_target_daily INTEGER DEFAULT 15;
  ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
  ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS current_lat DOUBLE PRECISION;
  ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS current_lng DOUBLE PRECISION;
  ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS last_location_update TIMESTAMPTZ;
  ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
END $$;

-- ─── 2. EMPLOYEE_LOCATION_HISTORY ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.employee_location_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accuracy_m DOUBLE PRECISION,
  is_mock BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE public.employee_location_history ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE;
  ALTER TABLE public.employee_location_history ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
  ALTER TABLE public.employee_location_history ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
  ALTER TABLE public.employee_location_history ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE public.employee_location_history ADD COLUMN IF NOT EXISTS accuracy_m DOUBLE PRECISION;
  ALTER TABLE public.employee_location_history ADD COLUMN IF NOT EXISTS is_mock BOOLEAN DEFAULT FALSE;
  ALTER TABLE public.employee_location_history ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
END $$;

CREATE INDEX IF NOT EXISTS idx_elh_employee_ts
  ON public.employee_location_history(employee_id, timestamp DESC);

-- ─── 3. EMPLOYEE_SHIFTS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.employee_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  start_lat DOUBLE PRECISION,
  start_lng DOUBLE PRECISION,
  end_lat DOUBLE PRECISION,
  end_lng DOUBLE PRECISION,
  start_selfie_url TEXT,
  end_selfie_url TEXT,
  duration_min INTEGER,
  visit_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE public.employee_shifts ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE;
  ALTER TABLE public.employee_shifts ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE public.employee_shifts ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
  ALTER TABLE public.employee_shifts ADD COLUMN IF NOT EXISTS start_lat DOUBLE PRECISION;
  ALTER TABLE public.employee_shifts ADD COLUMN IF NOT EXISTS start_lng DOUBLE PRECISION;
  ALTER TABLE public.employee_shifts ADD COLUMN IF NOT EXISTS end_lat DOUBLE PRECISION;
  ALTER TABLE public.employee_shifts ADD COLUMN IF NOT EXISTS end_lng DOUBLE PRECISION;
  ALTER TABLE public.employee_shifts ADD COLUMN IF NOT EXISTS start_selfie_url TEXT;
  ALTER TABLE public.employee_shifts ADD COLUMN IF NOT EXISTS end_selfie_url TEXT;
  ALTER TABLE public.employee_shifts ADD COLUMN IF NOT EXISTS duration_min INTEGER;
  ALTER TABLE public.employee_shifts ADD COLUMN IF NOT EXISTS visit_count INTEGER DEFAULT 0;
  ALTER TABLE public.employee_shifts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
END $$;

CREATE INDEX IF NOT EXISTS idx_shifts_employee_started
  ON public.employee_shifts(employee_id, started_at DESC);

-- ─── 4. SOCIETY_DATA ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.society_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  contact_person TEXT,
  contact_phone TEXT,
  number_of_flats INTEGER,
  status TEXT DEFAULT 'Pending',
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  accuracy_m DOUBLE PRECISION,
  is_mock BOOLEAN DEFAULT FALSE,
  selfie_url TEXT,
  building_photo_url TEXT,
  verification_status TEXT DEFAULT 'pending',
  verification_notes TEXT,
  verified_at TIMESTAMPTZ,
  verified_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE public.society_data ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE;
  ALTER TABLE public.society_data ADD COLUMN IF NOT EXISTS name TEXT;
  ALTER TABLE public.society_data ADD COLUMN IF NOT EXISTS address TEXT;
  ALTER TABLE public.society_data ADD COLUMN IF NOT EXISTS contact_person TEXT;
  ALTER TABLE public.society_data ADD COLUMN IF NOT EXISTS contact_phone TEXT;
  ALTER TABLE public.society_data ADD COLUMN IF NOT EXISTS number_of_flats INTEGER;
  ALTER TABLE public.society_data ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Pending';
  ALTER TABLE public.society_data ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
  ALTER TABLE public.society_data ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
  ALTER TABLE public.society_data ADD COLUMN IF NOT EXISTS accuracy_m DOUBLE PRECISION;
  ALTER TABLE public.society_data ADD COLUMN IF NOT EXISTS is_mock BOOLEAN DEFAULT FALSE;
  ALTER TABLE public.society_data ADD COLUMN IF NOT EXISTS selfie_url TEXT;
  ALTER TABLE public.society_data ADD COLUMN IF NOT EXISTS building_photo_url TEXT;
  ALTER TABLE public.society_data ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending';
  ALTER TABLE public.society_data ADD COLUMN IF NOT EXISTS verification_notes TEXT;
  ALTER TABLE public.society_data ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
  ALTER TABLE public.society_data ADD COLUMN IF NOT EXISTS verified_by UUID;
  ALTER TABLE public.society_data ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
END $$;

CREATE INDEX IF NOT EXISTS idx_society_employee_created
  ON public.society_data(employee_id, created_at DESC);

-- ─── 5. ASSIGNED_SOCIETIES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.assigned_societies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  society_name TEXT NOT NULL,
  address TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  priority INTEGER DEFAULT 0,
  notes TEXT,
  assigned_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  visited_at TIMESTAMPTZ,
  visit_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE public.assigned_societies ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE;
  ALTER TABLE public.assigned_societies ADD COLUMN IF NOT EXISTS society_name TEXT;
  ALTER TABLE public.assigned_societies ADD COLUMN IF NOT EXISTS address TEXT;
  ALTER TABLE public.assigned_societies ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
  ALTER TABLE public.assigned_societies ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
  ALTER TABLE public.assigned_societies ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;
  ALTER TABLE public.assigned_societies ADD COLUMN IF NOT EXISTS notes TEXT;
  ALTER TABLE public.assigned_societies ADD COLUMN IF NOT EXISTS assigned_date TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE public.assigned_societies ADD COLUMN IF NOT EXISTS visited_at TIMESTAMPTZ;
  ALTER TABLE public.assigned_societies ADD COLUMN IF NOT EXISTS visit_id UUID;
  ALTER TABLE public.assigned_societies ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
END $$;

CREATE INDEX IF NOT EXISTS idx_assigned_employee_date
  ON public.assigned_societies(employee_id, assigned_date DESC);

-- ─── 6. STORAGE BUCKET ────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('field-evidence', 'field-evidence', true)
ON CONFLICT (id) DO NOTHING;

-- ─── 7. RLS ────────────────────────────────────────────────────────────────
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_location_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.society_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assigned_societies ENABLE ROW LEVEL SECURITY;

-- employees
DROP POLICY IF EXISTS "employees_select_own" ON public.employees;
CREATE POLICY "employees_select_own" ON public.employees FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "employees_update_own" ON public.employees;
CREATE POLICY "employees_update_own" ON public.employees FOR UPDATE USING (auth.uid() = id);

-- employee_location_history
DROP POLICY IF EXISTS "elh_insert_own" ON public.employee_location_history;
CREATE POLICY "elh_insert_own" ON public.employee_location_history FOR INSERT WITH CHECK (auth.uid() = employee_id);
DROP POLICY IF EXISTS "elh_select_own" ON public.employee_location_history;
CREATE POLICY "elh_select_own" ON public.employee_location_history FOR SELECT USING (auth.uid() = employee_id);

-- employee_shifts
DROP POLICY IF EXISTS "shifts_insert_own" ON public.employee_shifts;
CREATE POLICY "shifts_insert_own" ON public.employee_shifts FOR INSERT WITH CHECK (auth.uid() = employee_id);
DROP POLICY IF EXISTS "shifts_select_own" ON public.employee_shifts;
CREATE POLICY "shifts_select_own" ON public.employee_shifts FOR SELECT USING (auth.uid() = employee_id);
DROP POLICY IF EXISTS "shifts_update_own" ON public.employee_shifts;
CREATE POLICY "shifts_update_own" ON public.employee_shifts FOR UPDATE USING (auth.uid() = employee_id);

-- society_data
DROP POLICY IF EXISTS "society_insert_own" ON public.society_data;
CREATE POLICY "society_insert_own" ON public.society_data FOR INSERT WITH CHECK (auth.uid() = employee_id);
DROP POLICY IF EXISTS "society_select_own" ON public.society_data;
CREATE POLICY "society_select_own" ON public.society_data FOR SELECT USING (auth.uid() = employee_id);
DROP POLICY IF EXISTS "society_update_own" ON public.society_data;
CREATE POLICY "society_update_own" ON public.society_data FOR UPDATE USING (auth.uid() = employee_id);

-- assigned_societies
DROP POLICY IF EXISTS "assigned_select_own" ON public.assigned_societies;
CREATE POLICY "assigned_select_own" ON public.assigned_societies FOR SELECT USING (auth.uid() = employee_id);
DROP POLICY IF EXISTS "assigned_update_own" ON public.assigned_societies;
CREATE POLICY "assigned_update_own" ON public.assigned_societies FOR UPDATE USING (auth.uid() = employee_id);

-- storage policies
DROP POLICY IF EXISTS "field_evidence_upload" ON storage.objects;
CREATE POLICY "field_evidence_upload" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'field-evidence' AND (storage.foldername(name))[1] = auth.uid()::text
);
DROP POLICY IF EXISTS "field_evidence_read" ON storage.objects;
CREATE POLICY "field_evidence_read" ON storage.objects FOR SELECT USING (bucket_id = 'field-evidence');

-- ─── 8. VERIFY — print what exists ─────────────────────────────────────────
SELECT '=== VERIFICATION ===' AS info;

SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('employees','employee_location_history','employee_shifts','society_data','assigned_societies')
ORDER BY table_name, ordinal_position;
