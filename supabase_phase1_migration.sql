-- ==============================================================================
-- CreativeMark CRM — Phase 1 Supplementary Migration
-- Adds missing enums, calendar_events table, and fixes reminder_type reference
-- Run AFTER supabase_schema_migration.sql in Supabase SQL Editor
-- ==============================================================================

-- 1. Create missing reminder_type and calendar enums
DO $$ BEGIN
  CREATE TYPE reminder_type AS ENUM ('whatsapp', 'email', 'sms', 'call');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE calendar_event_type AS ENUM ('Shoot', 'Meeting', 'Deadline', 'Holiday', 'Internal');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE calendar_event_status AS ENUM ('Scheduled', 'Completed', 'Cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Calendar Events table
CREATE TABLE IF NOT EXISTS calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    type calendar_event_type NOT NULL DEFAULT 'Meeting',
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    location TEXT,
    notes TEXT,
    status calendar_event_status DEFAULT 'Scheduled',
    created_by UUID REFERENCES employees(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Calendar Event Assignments (many-to-many with employees)
CREATE TABLE IF NOT EXISTS calendar_event_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES calendar_events(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    UNIQUE(event_id, employee_id)
);

-- 4. Add service_type column to clients if not exists
DO $$ BEGIN
  ALTER TABLE clients ADD COLUMN IF NOT EXISTS service_type TEXT;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- 5. Add missing lead lifecycle columns
DO $$ BEGIN
  ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_interaction_date DATE;
  ALTER TABLE leads ADD COLUMN IF NOT EXISTS action_item TEXT;
  ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_call_date DATE;
  ALTER TABLE leads ADD COLUMN IF NOT EXISTS quotation_status TEXT DEFAULT 'Not Sent';
  ALTER TABLE leads ADD COLUMN IF NOT EXISTS quotation_id UUID REFERENCES quotations(id) ON DELETE SET NULL;
  ALTER TABLE leads ADD COLUMN IF NOT EXISTS bill_id UUID REFERENCES quotations(id) ON DELETE SET NULL;
  ALTER TABLE leads ADD COLUMN IF NOT EXISTS payment_due_date DATE;
  ALTER TABLE leads ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'Not Due';
  ALTER TABLE leads ADD COLUMN IF NOT EXISTS lifecycle_stage TEXT DEFAULT 'Lead';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 6. Add terms, notes, and payment tracking columns to quotations if not exist
DO $$ BEGIN
  ALTER TABLE quotations ADD COLUMN IF NOT EXISTS terms TEXT;
  ALTER TABLE quotations ADD COLUMN IF NOT EXISTS internal_notes TEXT;
  ALTER TABLE quotations ADD COLUMN IF NOT EXISTS sent_via TEXT;
  ALTER TABLE quotations ADD COLUMN IF NOT EXISTS amount_paid NUMERIC DEFAULT 0;
  ALTER TABLE quotations ADD COLUMN IF NOT EXISTS client_email TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 7. Add description/unit columns to quotation_items if not exist
DO $$ BEGIN
  ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS description TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 8. Enable RLS on new tables
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_event_assignments ENABLE ROW LEVEL SECURITY;

-- 9. Basic RLS policies for calendar
DO $$ BEGIN
  DROP POLICY IF EXISTS "Everyone can view calendar events" ON calendar_events;
  CREATE POLICY "Everyone can view calendar events" ON calendar_events
      FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Authenticated users can manage calendar events" ON calendar_events;
  CREATE POLICY "Authenticated users can manage calendar events" ON calendar_events
      FOR ALL USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Everyone can view calendar assignments" ON calendar_event_assignments;
  CREATE POLICY "Everyone can view calendar assignments" ON calendar_event_assignments
      FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Authenticated users can manage calendar assignments" ON calendar_event_assignments;
  CREATE POLICY "Authenticated users can manage calendar assignments" ON calendar_event_assignments
      FOR ALL USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 10. Add open RLS policies for tables that need write access
-- (Supplement the existing schema's restrictive policies, applying consistent API access rules)

DO $$ BEGIN
  DROP POLICY IF EXISTS "Authenticated users can insert clients" ON clients;
  CREATE POLICY "Authenticated users can insert clients" ON clients
      FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can update their assigned clients" ON clients;
  CREATE POLICY "Users can update their assigned clients" ON clients
      FOR UPDATE USING (
          (auth.uid() IN (SELECT id FROM employees WHERE role = 'Admin')) OR 
          (id IN (SELECT client_id FROM client_assignments WHERE employee_id = auth.uid()))
      );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Authenticated users can insert leads" ON leads;
  CREATE POLICY "Authenticated users can insert leads" ON leads
      FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can update their assigned leads" ON leads;
  CREATE POLICY "Users can update their assigned leads" ON leads
      FOR UPDATE USING (
          (auth.uid() IN (SELECT id FROM employees WHERE role = 'Admin')) OR 
          (assigned_to = auth.uid())
      );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Authenticated users can insert quotations" ON quotations;
  CREATE POLICY "Authenticated users can insert quotations" ON quotations
      FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Admins can update quotations" ON quotations;
  CREATE POLICY "Admins can update quotations" ON quotations
      FOR UPDATE USING (
          (auth.uid() IN (SELECT id FROM employees WHERE role = 'Admin'))
      );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Admins can manage quotation_items" ON quotation_items;
  CREATE POLICY "Admins can manage quotation_items" ON quotation_items
      FOR ALL USING (
          (auth.uid() IN (SELECT id FROM employees WHERE role = 'Admin'))
      );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Admins can manage partners" ON partners;
  CREATE POLICY "Admins can manage partners" ON partners
      FOR ALL USING (
          (auth.uid() IN (SELECT id FROM employees WHERE role = 'Admin'))
      );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Partner sub-tables
ALTER TABLE partner_commission_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_notes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Authenticated access partner_commission_rates" ON partner_commission_rates;
  CREATE POLICY "Authenticated access partner_commission_rates" ON partner_commission_rates FOR SELECT USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Admin manage partner_commission_rates" ON partner_commission_rates;
  CREATE POLICY "Admin manage partner_commission_rates" ON partner_commission_rates FOR ALL USING (auth.uid() IN (SELECT id FROM employees WHERE role = 'Admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Authenticated access partner_leads" ON partner_leads;
  CREATE POLICY "Authenticated access partner_leads" ON partner_leads FOR SELECT USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Admin manage partner_leads" ON partner_leads;
  CREATE POLICY "Admin manage partner_leads" ON partner_leads FOR ALL USING (auth.uid() IN (SELECT id FROM employees WHERE role = 'Admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Authenticated access partner_ledger" ON partner_ledger;
  CREATE POLICY "Authenticated access partner_ledger" ON partner_ledger FOR SELECT USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Admin manage partner_ledger" ON partner_ledger;
  CREATE POLICY "Admin manage partner_ledger" ON partner_ledger FOR ALL USING (auth.uid() IN (SELECT id FROM employees WHERE role = 'Admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Authenticated access recovery_reminders" ON recovery_reminders;
  CREATE POLICY "Authenticated access recovery_reminders" ON recovery_reminders FOR ALL USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Authenticated access recovery_notes" ON recovery_notes;
  CREATE POLICY "Authenticated access recovery_notes" ON recovery_notes FOR ALL USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 11. Allow custom text in client category (override ENUM restriction)
ALTER TABLE clients ALTER COLUMN category TYPE TEXT USING category::text;

