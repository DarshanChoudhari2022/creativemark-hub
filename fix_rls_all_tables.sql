-- ===========================================================================
-- CreativeMark CRM — MASTER RLS FIX (run in Supabase SQL Editor)
-- Fixes: Clients 0, Projects 0, Work Log insert fail, all data access
-- Safe to re-run. Idempotent.
-- ===========================================================================

-- This script:
-- 1. Enables RLS on every CRM table (if not already)
-- 2. Drops ALL existing restrictive policies
-- 3. Creates simple permissive policies (USING true / WITH CHECK true)
-- 4. Covers projects, expenses, and all other tables

DO $$
DECLARE
  tbl TEXT;
  pol RECORD;
  tbls TEXT[] := ARRAY[
    -- Core tables
    'employees', 'clients', 'projects',
    -- Junction / child tables
    'client_assignments', 'client_services', 'client_shoots', 'client_posts',
    -- Scheduling
    'social_posts', 'shoot_schedules', 'shoot_assignments',
    -- Finance
    'payment_entries', 'payment_history', 'expenses', 'salary_payments',
    -- Work
    'work_logs',
    -- Leads
    'leads', 'lead_services', 'comm_logs', 'lead_tasks',
    -- Quotations
    'quotations', 'quotation_items',
    -- Partners
    'partners', 'partner_commission_rates', 'partner_leads', 'partner_ledger',
    -- Recovery
    'recovery_reminders', 'recovery_notes',
    -- Calendar
    'calendar_events', 'calendar_event_assignments',
    -- Smart Leads
    'smart_leads', 'sales_roster', 'lead_activity_log', 'webhook_config',
    -- Notifications
    'notifications',
    -- Meetings
    'client_meetings'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    -- Skip if table doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      RAISE NOTICE 'Table % does not exist, skipping', tbl;
      CONTINUE;
    END IF;

    -- Enable RLS
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);

    -- Drop ALL existing policies on this table
    FOR pol IN
      SELECT policyname FROM pg_policies WHERE tablename = tbl AND schemaname = 'public'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, tbl);
    END LOOP;

    -- Create SELECT policy (anyone authenticated can read)
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (true)',
      tbl || '_select_auth', tbl
    );

    -- Create INSERT policy (anyone authenticated can insert)
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (true)',
      tbl || '_insert_auth', tbl
    );

    -- Create UPDATE policy (anyone authenticated can update)
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)',
      tbl || '_update_auth', tbl
    );

    -- Create DELETE policy (anyone authenticated can delete)
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (true)',
      tbl || '_delete_auth', tbl
    );

    -- Service role full access
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      tbl || '_service_all', tbl
    );

    RAISE NOTICE 'RLS policies created for: %', tbl;
  END LOOP;
END $$;

-- Also ensure the projects table exists with all needed columns
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  quotation_id UUID REFERENCES quotations(id) ON DELETE SET NULL,
  description TEXT,
  status TEXT DEFAULT 'Planning',
  priority TEXT DEFAULT 'Medium',
  start_date DATE,
  end_date DATE,
  estimated_hours NUMERIC(10, 2),
  actual_hours NUMERIC(10, 2) DEFAULT 0,
  budget_revenue NUMERIC DEFAULT 0,
  budget_cost NUMERIC DEFAULT 0,
  created_by UUID,
  assigned_to UUID,
  project_type TEXT DEFAULT 'Client Project',
  features_summary TEXT,
  project_link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add any missing columns to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS budget_revenue NUMERIC DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS budget_cost NUMERIC DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_type TEXT DEFAULT 'Client Project';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS features_summary TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_link TEXT;

-- Ensure expenses table exists
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  category TEXT DEFAULT 'Other',
  date DATE DEFAULT CURRENT_DATE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure work_logs has amount column
ALTER TABLE work_logs ADD COLUMN IF NOT EXISTS amount NUMERIC DEFAULT 0;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- ===========================================================================
-- DONE — Run this in Supabase SQL Editor, then refresh your app
-- ===========================================================================
