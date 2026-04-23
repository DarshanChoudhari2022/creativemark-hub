-- ===========================================================================
-- CreativeMark CRM — COMPLETE SCHEMA FIX (single idempotent script)
-- Run in Supabase SQL Editor. Safe to re-run. Zero data loss.
-- ===========================================================================

-- ╔═══════════════════════════════════════════════════════════╗
-- ║  1. CONVERT ALL ENUM COLUMNS TO TEXT                     ║
-- ╚═══════════════════════════════════════════════════════════╝

DO $$ BEGIN ALTER TABLE employees ALTER COLUMN role TYPE TEXT USING role::text; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE employees ALTER COLUMN status TYPE TEXT USING status::text; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE employees ALTER COLUMN contract_type TYPE TEXT USING contract_type::text; EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE clients ALTER COLUMN category TYPE TEXT USING category::text; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE clients ALTER COLUMN status TYPE TEXT USING status::text; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE clients ALTER COLUMN payment_status TYPE TEXT USING payment_status::text; EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE leads ALTER COLUMN category TYPE TEXT USING category::text; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE leads ALTER COLUMN source TYPE TEXT USING source::text; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE leads ALTER COLUMN stage TYPE TEXT USING stage::text; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE leads ALTER COLUMN heat TYPE TEXT USING heat::text; EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE social_posts ALTER COLUMN post_type TYPE TEXT USING post_type::text; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE social_posts ALTER COLUMN platform TYPE TEXT USING platform::text; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE social_posts ALTER COLUMN status TYPE TEXT USING status::text; EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE shoot_schedules ALTER COLUMN shoot_type TYPE TEXT USING shoot_type::text; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE shoot_schedules ALTER COLUMN status TYPE TEXT USING status::text; EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE payment_entries ALTER COLUMN status TYPE TEXT USING status::text; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE payment_entries ALTER COLUMN payment_method TYPE TEXT USING payment_method::text; EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE work_logs ALTER COLUMN work_type TYPE TEXT USING work_type::text; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE work_logs ALTER COLUMN status TYPE TEXT USING status::text; EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE salary_payments ALTER COLUMN payment_method TYPE TEXT USING payment_method::text; EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE comm_logs ALTER COLUMN method TYPE TEXT USING method::text; EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE lead_tasks ALTER COLUMN status TYPE TEXT USING status::text; EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE quotations ALTER COLUMN type TYPE TEXT USING type::text; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE quotations ALTER COLUMN status TYPE TEXT USING status::text; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE quotations ALTER COLUMN discount_type TYPE TEXT USING discount_type::text; EXCEPTION WHEN others THEN NULL; END $$;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║  1b. FIX employees.id — allow standalone inserts         ║
-- ╚═══════════════════════════════════════════════════════════╝

ALTER TABLE employees ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_id_fkey;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║  2. ADD ALL MISSING COLUMNS ON employees                 ║
-- ╚═══════════════════════════════════════════════════════════╝

ALTER TABLE employees ADD COLUMN IF NOT EXISTS custom_role TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS salary NUMERIC DEFAULT 0;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS lead_target INTEGER DEFAULT 50;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS advance_taken NUMERIC DEFAULT 0;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS dues_pending NUMERIC DEFAULT 0;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS on_field_today BOOLEAN DEFAULT false;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║  3. ADD ALL MISSING COLUMNS ON clients                   ║
-- ╚═══════════════════════════════════════════════════════════╝

ALTER TABLE clients ADD COLUMN IF NOT EXISTS service_type TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS whatsapp TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS area TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS total_billed NUMERIC DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS outstanding NUMERIC DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS monthly_retainer NUMERIC DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS assigned_employees UUID[] DEFAULT '{}';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contact_person TEXT;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║  4. ADD ALL MISSING COLUMNS ON leads                     ║
-- ╚═══════════════════════════════════════════════════════════╝

ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_interaction_date DATE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS action_item TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_call_date DATE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS quotation_status TEXT DEFAULT 'Not Sent';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS payment_due_date DATE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'Not Due';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lifecycle_stage TEXT DEFAULT 'Lead';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS organization TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS date_received DATE DEFAULT CURRENT_DATE;

-- FK columns (safe if quotations table doesn't exist yet)
DO $$ BEGIN
  ALTER TABLE leads ADD COLUMN IF NOT EXISTS quotation_id UUID REFERENCES quotations(id) ON DELETE SET NULL;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE leads ADD COLUMN IF NOT EXISTS bill_id UUID REFERENCES quotations(id) ON DELETE SET NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║  5. ADD MISSING COLUMNS ON quotations                    ║
-- ╚═══════════════════════════════════════════════════════════╝

ALTER TABLE quotations ADD COLUMN IF NOT EXISTS terms TEXT;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS internal_notes TEXT;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS sent_via TEXT;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS amount_paid NUMERIC DEFAULT 0;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS client_email TEXT;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║  6. ADD MISSING COLUMNS ON quotation_items               ║
-- ╚═══════════════════════════════════════════════════════════╝

ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS description TEXT;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║  7. ADD MISSING COLUMNS ON work_logs                     ║
-- ╚═══════════════════════════════════════════════════════════╝

ALTER TABLE work_logs ADD COLUMN IF NOT EXISTS hours NUMERIC DEFAULT 0;
ALTER TABLE work_logs ADD COLUMN IF NOT EXISTS client_name TEXT;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║  8. CREATE MISSING TABLES                                ║
-- ╚═══════════════════════════════════════════════════════════╝

-- calendar_events
CREATE TABLE IF NOT EXISTS calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'Meeting',
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    client_name TEXT,
    assigned_to TEXT,
    location TEXT,
    notes TEXT,
    status TEXT DEFAULT 'Scheduled',
    created_by UUID REFERENCES employees(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS calendar_event_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES calendar_events(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    UNIQUE(event_id, employee_id)
);

-- client_shoots
CREATE TABLE IF NOT EXISTS client_shoots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    date DATE,
    reporting_time TEXT,
    location TEXT,
    assigned_employees TEXT[] DEFAULT '{}',
    status TEXT DEFAULT 'Scheduled',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- client_posts
CREATE TABLE IF NOT EXISTS client_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    date DATE,
    platform TEXT DEFAULT 'Instagram',
    post_type TEXT DEFAULT 'Image',
    caption TEXT,
    status TEXT DEFAULT 'Draft',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- payment_history
CREATE TABLE IF NOT EXISTS payment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    invoice_no TEXT,
    date DATE,
    amount NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'Pending',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- partners
CREATE TABLE IF NOT EXISTS partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT DEFAULT 'Referral',
    phone TEXT,
    whatsapp TEXT,
    email TEXT,
    company TEXT,
    commission_rate NUMERIC DEFAULT 10,
    notes TEXT,
    status TEXT DEFAULT 'Active',
    total_referrals INTEGER DEFAULT 0,
    total_converted INTEGER DEFAULT 0,
    total_earned NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS partner_commission_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID REFERENCES partners(id) ON DELETE CASCADE,
    service_name TEXT,
    rate NUMERIC DEFAULT 10,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS partner_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID REFERENCES partners(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'Referred',
    commission_amount NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS partner_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID REFERENCES partners(id) ON DELETE CASCADE,
    date DATE DEFAULT CURRENT_DATE,
    type TEXT DEFAULT 'Credit',
    amount NUMERIC DEFAULT 0,
    description TEXT,
    reference TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- recovery tables
CREATE TABLE IF NOT EXISTS recovery_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID REFERENCES quotations(id) ON DELETE CASCADE,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    method TEXT DEFAULT 'WhatsApp',
    type TEXT DEFAULT 'soft',
    notes TEXT
);

CREATE TABLE IF NOT EXISTS recovery_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID REFERENCES quotations(id) ON DELETE CASCADE,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- smart_leads
CREATE TABLE IF NOT EXISTS smart_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_name TEXT NOT NULL,
    phone TEXT DEFAULT '',
    whatsapp TEXT DEFAULT '',
    email TEXT,
    source TEXT NOT NULL DEFAULT 'Walk-in',
    vehicle_interest TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'New',
    assigned_to UUID REFERENCES employees(id),
    assigned_at TIMESTAMPTZ,
    assignment_method TEXT,
    notification_sent BOOLEAN DEFAULT FALSE,
    first_response_at TIMESTAMPTZ,
    response_time_seconds INTEGER,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- sales_roster
CREATE TABLE IF NOT EXISTS sales_roster (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    is_available BOOLEAN DEFAULT TRUE,
    shift_start TEXT DEFAULT '09:00',
    shift_end TEXT DEFAULT '18:00',
    territory TEXT DEFAULT '',
    max_daily_leads INTEGER DEFAULT 50,
    leave_start DATE,
    leave_end DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- lead_activity_log
CREATE TABLE IF NOT EXISTS lead_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES smart_leads(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    details TEXT,
    actor_id UUID REFERENCES employees(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- webhook_config
CREATE TABLE IF NOT EXISTS webhook_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform TEXT NOT NULL UNIQUE,
    webhook_url TEXT,
    is_active BOOLEAN DEFAULT FALSE,
    api_key TEXT,
    verify_token TEXT,
    total_leads_received INTEGER DEFAULT 0,
    last_received_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ╔═══════════════════════════════════════════════════════════╗
-- ║  9. INDEXES                                              ║
-- ╚═══════════════════════════════════════════════════════════╝

CREATE INDEX IF NOT EXISTS idx_smart_leads_status ON smart_leads(status);
CREATE INDEX IF NOT EXISTS idx_smart_leads_source ON smart_leads(source);
CREATE INDEX IF NOT EXISTS idx_smart_leads_assigned ON smart_leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_smart_leads_created ON smart_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_activity_lead ON lead_activity_log(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_activity_type ON lead_activity_log(event_type);
CREATE INDEX IF NOT EXISTS idx_sales_roster_emp ON sales_roster(employee_id);

-- ╔═══════════════════════════════════════════════════════════╗
-- ║  10. ENABLE RLS ON ALL TABLES                            ║
-- ╚═══════════════════════════════════════════════════════════╝

DO $$ 
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'employees','clients','client_assignments','client_services',
    'social_posts','shoot_schedules','shoot_assignments',
    'payment_entries','work_logs','salary_payments',
    'leads','lead_services','comm_logs','lead_tasks',
    'quotations','quotation_items',
    'partners','partner_commission_rates','partner_leads','partner_ledger',
    'recovery_reminders','recovery_notes',
    'calendar_events','calendar_event_assignments',
    'client_shoots','client_posts','payment_history',
    'smart_leads','sales_roster','lead_activity_log','webhook_config'
  ])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║  11. DROP OLD + CREATE FRESH RLS POLICIES                ║
-- ╚═══════════════════════════════════════════════════════════╝

-- Helper: drop all policies on a table then create one "full access" policy
DO $$
DECLARE
  tbl TEXT;
  pol RECORD;
  tbls TEXT[] := ARRAY[
    'employees','clients','client_assignments','client_services',
    'social_posts','shoot_schedules','shoot_assignments',
    'payment_entries','work_logs','salary_payments',
    'leads','lead_services','comm_logs','lead_tasks',
    'quotations','quotation_items',
    'partners','partner_commission_rates','partner_leads','partner_ledger',
    'recovery_reminders','recovery_notes',
    'calendar_events','calendar_event_assignments',
    'client_shoots','client_posts','payment_history',
    'smart_leads','sales_roster','lead_activity_log','webhook_config'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    -- Drop every existing policy on the table
    FOR pol IN
      SELECT policyname FROM pg_policies WHERE tablename = tbl AND schemaname = 'public'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, tbl);
    END LOOP;

    -- Create authenticated + service_role policies
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL USING (auth.role() = ''authenticated'')',
      tbl || '_auth_all', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL USING (auth.role() = ''service_role'')',
      tbl || '_service_all', tbl
    );
  END LOOP;
END $$;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║  12. HELPER FUNCTIONS                                    ║
-- ╚═══════════════════════════════════════════════════════════╝

-- Increment webhook counter
CREATE OR REPLACE FUNCTION increment_webhook_leads(p_platform TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE webhook_config
  SET total_leads_received = total_leads_received + 1,
      last_received_at = NOW()
  WHERE platform = p_platform;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER smart_leads_updated_at
    BEFORE UPDATE ON smart_leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER sales_roster_updated_at
    BEFORE UPDATE ON sales_roster
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║  13. SEED DEFAULT WEBHOOK CONFIG                         ║
-- ╚═══════════════════════════════════════════════════════════╝

INSERT INTO webhook_config (platform, webhook_url, is_active) VALUES
  ('Just Dial', '/functions/v1/justdial-webhook', FALSE),
  ('Meta Ads', '/functions/v1/meta-leads-webhook', FALSE),
  ('Google Ads', '/functions/v1/google-leads-webhook', FALSE),
  ('OEM CRM', NULL, FALSE)
ON CONFLICT (platform) DO NOTHING;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║  DONE — All tables, columns, policies ready              ║
-- ╚═══════════════════════════════════════════════════════════╝
