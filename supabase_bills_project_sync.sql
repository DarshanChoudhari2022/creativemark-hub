-- ═══════════════════════════════════════════════════════════════════
-- Bills ↔ Projects sync + Payment Received-By tracking
-- + Money / Job Distribution per sale
-- Run this once in the Supabase SQL editor.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Link a Bill (quotation of type 'Bill') to a Project ──────────
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quotations_project_id
  ON public.quotations (project_id);

-- ── 2. Track who received the most-recent payment (denormalized for table view) ──
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS received_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS received_by_name TEXT,
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ;

-- ── 3. Track received-by on every payment_history entry too ─────────
-- (payment_history might or might not exist depending on which migrations ran;
--  guard with IF EXISTS so this script is idempotent.)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payment_history') THEN
    EXECUTE 'ALTER TABLE public.payment_history ADD COLUMN IF NOT EXISTS received_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL';
    EXECUTE 'ALTER TABLE public.payment_history ADD COLUMN IF NOT EXISTS received_by_name TEXT';
  END IF;
END $$;

-- ── 4. Money / Job distribution per sale (Bill or project_sale) ─────
-- Note: sale_id / employee_id FKs are added conditionally below (only if the
-- referenced tables actually exist in this Supabase project). The core table
-- only hard-depends on projects + quotations, which always exist.
CREATE TABLE IF NOT EXISTS public.project_sale_distributions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  -- Distribution can be linked to either a Bill (quotation) or a project_sale.
  bill_id         UUID REFERENCES public.quotations(id) ON DELETE CASCADE,
  sale_id         UUID,
  -- Who is being paid (can pick from employees or just type a name)
  employee_id     UUID,
  employee_name   TEXT NOT NULL,
  -- What job they did for this sale (Designer, Salesperson, Account Manager, etc.)
  job_role        TEXT NOT NULL,
  -- How much they get for this sale
  allotted_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  -- Has it been paid out yet?
  status          TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Paid')),
  paid_date       DATE,
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Must link to either a bill or a sale, not neither
  CONSTRAINT chk_sale_or_bill CHECK (bill_id IS NOT NULL OR sale_id IS NOT NULL)
);

-- Add sale_id FK only if project_sales exists (older Supabase projects may not have it yet).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'project_sales')
     AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema = 'public' AND constraint_name = 'project_sale_distributions_sale_id_fkey') THEN
    EXECUTE 'ALTER TABLE public.project_sale_distributions
             ADD CONSTRAINT project_sale_distributions_sale_id_fkey
             FOREIGN KEY (sale_id) REFERENCES public.project_sales(id) ON DELETE CASCADE';
  END IF;
END $$;

-- Add employee_id FK only if employees exists.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'employees')
     AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema = 'public' AND constraint_name = 'project_sale_distributions_employee_id_fkey') THEN
    EXECUTE 'ALTER TABLE public.project_sale_distributions
             ADD CONSTRAINT project_sale_distributions_employee_id_fkey
             FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_psd_project_id ON public.project_sale_distributions (project_id);
CREATE INDEX IF NOT EXISTS idx_psd_bill_id    ON public.project_sale_distributions (bill_id);
CREATE INDEX IF NOT EXISTS idx_psd_sale_id    ON public.project_sale_distributions (sale_id);
CREATE INDEX IF NOT EXISTS idx_psd_employee   ON public.project_sale_distributions (employee_id);

-- ── 5. RLS ──────────────────────────────────────────────────────────
ALTER TABLE public.project_sale_distributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "psd_authenticated_all" ON public.project_sale_distributions;
CREATE POLICY "psd_authenticated_all"
  ON public.project_sale_distributions
  FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ── 6. Trigger to auto-bump updated_at ──────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS psd_updated_at ON public.project_sale_distributions;
CREATE TRIGGER psd_updated_at
  BEFORE UPDATE ON public.project_sale_distributions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
