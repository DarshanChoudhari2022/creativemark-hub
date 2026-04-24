-- ==============================================================================
-- FINAL PARTNERS SCHEMA FIX
-- Run this in Supabase SQL Editor if you get 'database fields mismatch'
-- ==============================================================================

-- 1. Ensure all columns exist in the partners table
DO $$ 
BEGIN
    -- Core Columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'business_name') THEN
        ALTER TABLE partners ADD COLUMN business_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'category') THEN
        ALTER TABLE partners ADD COLUMN category TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'address') THEN
        ALTER TABLE partners ADD COLUMN address TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'pan') THEN
        ALTER TABLE partners ADD COLUMN pan TEXT;
    END IF;

    -- Banking
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'bank_account') THEN
        ALTER TABLE partners ADD COLUMN bank_account TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'ifsc') THEN
        ALTER TABLE partners ADD COLUMN ifsc TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'account_holder') THEN
        ALTER TABLE partners ADD COLUMN account_holder TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'bank_name') THEN
        ALTER TABLE partners ADD COLUMN bank_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'upi') THEN
        ALTER TABLE partners ADD COLUMN upi TEXT;
    END IF;

    -- Commission & Agreement
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'commission_type') THEN
        ALTER TABLE partners ADD COLUMN commission_type TEXT DEFAULT 'Percentage';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'commission_rate') THEN
        ALTER TABLE partners ADD COLUMN commission_rate NUMERIC DEFAULT 10;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'agreement_date') THEN
        ALTER TABLE partners ADD COLUMN agreement_date DATE DEFAULT CURRENT_DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'partner_since') THEN
        ALTER TABLE partners ADD COLUMN partner_since DATE DEFAULT CURRENT_DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'agreement_terms') THEN
        ALTER TABLE partners ADD COLUMN agreement_terms TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'status') THEN
        ALTER TABLE partners ADD COLUMN status TEXT DEFAULT 'Active';
    END IF;

    -- Ensure whatsapp column exists (critical for messaging)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'whatsapp') THEN
        ALTER TABLE partners ADD COLUMN whatsapp TEXT;
    END IF;
END $$;

-- 2. Drop any legacy columns that might conflict (if any)
-- e.g. if 'company' was used instead of 'business_name'
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'company') THEN
        UPDATE partners SET business_name = company WHERE business_name IS NULL;
        ALTER TABLE partners DROP COLUMN company;
    END IF;
END $$;

-- 3. Reset RLS to be safe
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage partners" ON partners;
CREATE POLICY "Admins manage partners" ON partners FOR ALL USING (true);

-- 4. Verify partner_ledger and partner_leads
ALTER TABLE partner_ledger ADD COLUMN IF NOT EXISTS commission_amount NUMERIC DEFAULT 0;
ALTER TABLE partner_ledger ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE partner_leads ADD COLUMN IF NOT EXISTS converted BOOLEAN DEFAULT false;
ALTER TABLE partner_leads ADD COLUMN IF NOT EXISTS deal_value NUMERIC DEFAULT 0;
