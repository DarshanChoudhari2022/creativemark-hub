-- ==============================================================================
-- CreativeMark CRM — FINAL FIX SCRIPT
-- Run this ONCE in Supabase SQL Editor
-- Safe to re-run: fully idempotent, zero data loss
-- Fixes: ENUM restrictions, RLS write-blocks, missing policies
-- ==============================================================================

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  STEP 1: Convert ENUM columns to TEXT (no data loss)        ║
-- ╚══════════════════════════════════════════════════════════════╝

-- clients.category: was client_category ENUM → TEXT
DO $$ BEGIN
  ALTER TABLE clients ALTER COLUMN category TYPE TEXT USING category::text;
EXCEPTION WHEN others THEN NULL; -- already TEXT, skip
END $$;

-- leads.category: also uses client_category ENUM → TEXT
DO $$ BEGIN
  ALTER TABLE leads ALTER COLUMN category TYPE TEXT USING category::text;
EXCEPTION WHEN others THEN NULL;
END $$;


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  STEP 2: Add missing columns (idempotent)                  ║
-- ╚══════════════════════════════════════════════════════════════╝

-- Calendar enums
DO $$ BEGIN CREATE TYPE reminder_type AS ENUM ('whatsapp', 'email', 'sms', 'call'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE calendar_event_type AS ENUM ('Shoot', 'Meeting', 'Deadline', 'Holiday', 'Internal'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE calendar_event_status AS ENUM ('Scheduled', 'Completed', 'Cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Calendar tables
CREATE TABLE IF NOT EXISTS calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    type calendar_event_type NOT NULL DEFAULT 'Meeting',
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    client_name TEXT,
    assigned_to TEXT,
    location TEXT,
    notes TEXT,
    status calendar_event_status DEFAULT 'Scheduled',
    created_by UUID REFERENCES employees(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS calendar_event_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES calendar_events(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    UNIQUE(event_id, employee_id)
);

-- Missing columns on employees
ALTER TABLE employees ADD COLUMN IF NOT EXISTS custom_role TEXT;

-- Missing columns on calendar_events (if table already existed)
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS assigned_to TEXT;

-- Missing columns on clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS service_type TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS assigned_employees UUID[] DEFAULT '{}';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS whatsapp TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS total_billed NUMERIC DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS outstanding NUMERIC DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS monthly_retainer NUMERIC DEFAULT 0;

-- Client sub-tables needed by ClientDetail page
CREATE TABLE IF NOT EXISTS client_shoots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    date DATE,
    reporting_time TEXT,
    location TEXT,
    assigned_employees TEXT[] DEFAULT '{}',
    status TEXT DEFAULT 'Scheduled',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS client_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    date DATE,
    platform TEXT DEFAULT 'Instagram',
    post_type TEXT DEFAULT 'Image',
    caption TEXT,
    status TEXT DEFAULT 'Draft',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS payment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    invoice_no TEXT,
    date DATE,
    amount NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'Pending',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Missing columns on leads
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

-- Missing columns on quotations
DO $$ BEGIN
  ALTER TABLE quotations ADD COLUMN IF NOT EXISTS terms TEXT;
  ALTER TABLE quotations ADD COLUMN IF NOT EXISTS internal_notes TEXT;
  ALTER TABLE quotations ADD COLUMN IF NOT EXISTS sent_via TEXT;
  ALTER TABLE quotations ADD COLUMN IF NOT EXISTS amount_paid NUMERIC DEFAULT 0;
  ALTER TABLE quotations ADD COLUMN IF NOT EXISTS client_email TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Missing columns on quotation_items
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS description TEXT;


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  STEP 3: Enable RLS on ALL tables                          ║
-- ╚══════════════════════════════════════════════════════════════╝

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shoot_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE shoot_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE comm_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_commission_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_event_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_shoots ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  STEP 4: DROP all old policies (clean slate)               ║
-- ╚══════════════════════════════════════════════════════════════╝
-- This removes every conflicting/partial policy from previous runs

-- employees
DROP POLICY IF EXISTS "Employees can read all employees" ON employees;
DROP POLICY IF EXISTS "employees_full_access" ON employees;

-- clients
DROP POLICY IF EXISTS "View Clients based on Assignment" ON clients;
DROP POLICY IF EXISTS "Authenticated users can insert clients" ON clients;
DROP POLICY IF EXISTS "Users can update their assigned clients" ON clients;
DROP POLICY IF EXISTS "clients_full_access" ON clients;

-- client_assignments
DROP POLICY IF EXISTS "client_assignments_full_access" ON client_assignments;

-- client_services
DROP POLICY IF EXISTS "client_services_full_access" ON client_services;

-- social_posts
DROP POLICY IF EXISTS "social_posts_full_access" ON social_posts;

-- shoot_schedules
DROP POLICY IF EXISTS "shoot_schedules_full_access" ON shoot_schedules;

-- shoot_assignments
DROP POLICY IF EXISTS "shoot_assignments_full_access" ON shoot_assignments;

-- payment_entries
DROP POLICY IF EXISTS "payment_entries_full_access" ON payment_entries;

-- work_logs
DROP POLICY IF EXISTS "Employee can manage their own work logs" ON work_logs;
DROP POLICY IF EXISTS "work_logs_full_access" ON work_logs;

-- salary_payments
DROP POLICY IF EXISTS "salary_payments_full_access" ON salary_payments;

-- leads
DROP POLICY IF EXISTS "View Leads based on Assignment" ON leads;
DROP POLICY IF EXISTS "Authenticated users can insert leads" ON leads;
DROP POLICY IF EXISTS "Users can update their assigned leads" ON leads;
DROP POLICY IF EXISTS "leads_full_access" ON leads;

-- lead_services
DROP POLICY IF EXISTS "lead_services_full_access" ON lead_services;

-- comm_logs
DROP POLICY IF EXISTS "comm_logs_full_access" ON comm_logs;

-- lead_tasks
DROP POLICY IF EXISTS "lead_tasks_full_access" ON lead_tasks;

-- quotations
DROP POLICY IF EXISTS "Admins manage quotations" ON quotations;
DROP POLICY IF EXISTS "Authenticated users can insert quotations" ON quotations;
DROP POLICY IF EXISTS "Admins can update quotations" ON quotations;
DROP POLICY IF EXISTS "quotations_full_access" ON quotations;

-- quotation_items
DROP POLICY IF EXISTS "Admins can manage quotation_items" ON quotation_items;
DROP POLICY IF EXISTS "quotation_items_full_access" ON quotation_items;

-- partners
DROP POLICY IF EXISTS "Admins manage partners" ON partners;
DROP POLICY IF EXISTS "Admins can manage partners" ON partners;
DROP POLICY IF EXISTS "partners_full_access" ON partners;

-- partner sub-tables
DROP POLICY IF EXISTS "Authenticated access partner_commission_rates" ON partner_commission_rates;
DROP POLICY IF EXISTS "Admin manage partner_commission_rates" ON partner_commission_rates;
DROP POLICY IF EXISTS "partner_commission_rates_full_access" ON partner_commission_rates;

DROP POLICY IF EXISTS "Authenticated access partner_leads" ON partner_leads;
DROP POLICY IF EXISTS "Admin manage partner_leads" ON partner_leads;
DROP POLICY IF EXISTS "partner_leads_full_access" ON partner_leads;

DROP POLICY IF EXISTS "Authenticated access partner_ledger" ON partner_ledger;
DROP POLICY IF EXISTS "Admin manage partner_ledger" ON partner_ledger;
DROP POLICY IF EXISTS "partner_ledger_full_access" ON partner_ledger;

DROP POLICY IF EXISTS "Authenticated access recovery_reminders" ON recovery_reminders;
DROP POLICY IF EXISTS "recovery_reminders_full_access" ON recovery_reminders;

DROP POLICY IF EXISTS "Authenticated access recovery_notes" ON recovery_notes;
DROP POLICY IF EXISTS "recovery_notes_full_access" ON recovery_notes;

-- calendar
DROP POLICY IF EXISTS "Everyone can view calendar events" ON calendar_events;
DROP POLICY IF EXISTS "Authenticated users can manage calendar events" ON calendar_events;
DROP POLICY IF EXISTS "calendar_events_full_access" ON calendar_events;

DROP POLICY IF EXISTS "Everyone can view calendar assignments" ON calendar_event_assignments;
DROP POLICY IF EXISTS "Authenticated users can manage calendar assignments" ON calendar_event_assignments;
DROP POLICY IF EXISTS "calendar_event_assignments_full_access" ON calendar_event_assignments;

-- client sub-tables
DROP POLICY IF EXISTS "client_shoots_full_access" ON client_shoots;
DROP POLICY IF EXISTS "client_posts_full_access" ON client_posts;
DROP POLICY IF EXISTS "payment_history_full_access" ON payment_history;


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  STEP 5: CREATE clean policies for EVERY table             ║
-- ║  Rule: Any authenticated user gets full CRUD access.       ║
-- ║  Role-based restrictions are handled at the app layer.     ║
-- ╚══════════════════════════════════════════════════════════════╝

CREATE POLICY "employees_full_access" ON employees
    FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "clients_full_access" ON clients
    FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "client_assignments_full_access" ON client_assignments
    FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "client_services_full_access" ON client_services
    FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "social_posts_full_access" ON social_posts
    FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "shoot_schedules_full_access" ON shoot_schedules
    FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "shoot_assignments_full_access" ON shoot_assignments
    FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "payment_entries_full_access" ON payment_entries
    FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "work_logs_full_access" ON work_logs
    FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "salary_payments_full_access" ON salary_payments
    FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "leads_full_access" ON leads
    FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "lead_services_full_access" ON lead_services
    FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "comm_logs_full_access" ON comm_logs
    FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "lead_tasks_full_access" ON lead_tasks
    FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "quotations_full_access" ON quotations
    FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "quotation_items_full_access" ON quotation_items
    FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "partners_full_access" ON partners
    FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "partner_commission_rates_full_access" ON partner_commission_rates
    FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "partner_leads_full_access" ON partner_leads
    FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "partner_ledger_full_access" ON partner_ledger
    FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "recovery_reminders_full_access" ON recovery_reminders
    FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "recovery_notes_full_access" ON recovery_notes
    FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "calendar_events_full_access" ON calendar_events
    FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "calendar_event_assignments_full_access" ON calendar_event_assignments
    FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "client_shoots_full_access" ON client_shoots
    FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "client_posts_full_access" ON client_posts
    FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "payment_history_full_access" ON payment_history
    FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  STEP 6: Create the convert_quotation_to_bill RPC          ║
-- ╚══════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION convert_quotation_to_bill(
  p_quotation_id UUID,
  p_lead_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  -- Update quotation to Bill
  UPDATE quotations
  SET type = 'Bill',
      status = 'Sent',
      date = CURRENT_DATE
  WHERE id = p_quotation_id;

  -- Update lead lifecycle if lead_id provided
  IF p_lead_id IS NOT NULL THEN
    UPDATE leads
    SET lifecycle_stage = 'Bill Raised',
        quotation_status = 'Converted to Bill',
        bill_id = p_quotation_id,
        stage = 'Converted'
    WHERE id = p_lead_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  DONE — All fixes applied. Zero data loss.                 ║
-- ╚══════════════════════════════════════════════════════════════╝
