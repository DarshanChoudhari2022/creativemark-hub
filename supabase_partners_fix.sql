-- ==============================================================================
-- Fix Partners Schema & Professional Terms
-- ==============================================================================

-- 1. Ensure partners table has all required fields
DO $$ 
BEGIN
    -- Rename 'company' to 'business_name' if it exists (from complete_fix)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'company') THEN
        ALTER TABLE partners RENAME COLUMN company TO business_name;
    END IF;

    -- Rename 'type' to 'commission_type' if it exists (from complete_fix)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'type') THEN
        ALTER TABLE partners RENAME COLUMN type TO commission_type;
    END IF;
END $$;

-- Add missing columns to partners
ALTER TABLE partners ADD COLUMN IF NOT EXISTS business_name TEXT;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS pan TEXT;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS bank_account TEXT;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS ifsc TEXT;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS account_holder TEXT;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS upi TEXT;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS commission_type TEXT DEFAULT 'Percentage';
ALTER TABLE partners ADD COLUMN IF NOT EXISTS commission_rate NUMERIC DEFAULT 10;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS agreement_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS partner_since DATE DEFAULT CURRENT_DATE;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
ALTER TABLE partners ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS agreement_terms TEXT;

-- 2. Ensure partner_ledger table is correct
ALTER TABLE partner_ledger ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'Credit';
ALTER TABLE partner_ledger ADD COLUMN IF NOT EXISTS amount NUMERIC DEFAULT 0;
ALTER TABLE partner_ledger ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE partner_ledger ADD COLUMN IF NOT EXISTS reference TEXT;
ALTER TABLE partner_ledger ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Pending';
ALTER TABLE partner_ledger ADD COLUMN IF NOT EXISTS commission_amount NUMERIC DEFAULT 0;
ALTER TABLE partner_ledger ADD COLUMN IF NOT EXISTS commission_percent NUMERIC DEFAULT 0;
ALTER TABLE partner_ledger ADD COLUMN IF NOT EXISTS invoice_amount NUMERIC DEFAULT 0;
ALTER TABLE partner_ledger ADD COLUMN IF NOT EXISTS service_name TEXT;
ALTER TABLE partner_ledger ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE partner_ledger ADD COLUMN IF NOT EXISTS client_name TEXT;

-- 3. Ensure partner_leads table is correct
ALTER TABLE partner_leads ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES leads(id) ON DELETE CASCADE;
ALTER TABLE partner_leads ADD COLUMN IF NOT EXISTS lead_name TEXT;
ALTER TABLE partner_leads ADD COLUMN IF NOT EXISTS date_referred DATE DEFAULT CURRENT_DATE;
ALTER TABLE partner_leads ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Referred';
ALTER TABLE partner_leads ADD COLUMN IF NOT EXISTS commission_amount NUMERIC DEFAULT 0;
ALTER TABLE partner_leads ADD COLUMN IF NOT EXISTS deal_value NUMERIC DEFAULT 0;
ALTER TABLE partner_leads ADD COLUMN IF NOT EXISTS converted BOOLEAN DEFAULT false;
ALTER TABLE partner_leads ADD COLUMN IF NOT EXISTS current_stage TEXT;

-- 4. Enable RLS and add basic policy
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage partners" ON partners;
CREATE POLICY "Admins manage partners" ON partners FOR ALL USING (true); -- Simplified for now, or use auth checks

ALTER TABLE partner_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage partner_ledger" ON partner_ledger;
CREATE POLICY "Admins manage partner_ledger" ON partner_ledger FOR ALL USING (true);

ALTER TABLE partner_leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage partner_leads" ON partner_leads;
CREATE POLICY "Admins manage partner_leads" ON partner_leads FOR ALL USING (true);
