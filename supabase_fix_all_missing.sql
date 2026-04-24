-- ════════════════════════════════════════════════════════════════════
-- MASTER FIX: All Missing Tables & Columns — Run in Supabase SQL Editor
-- Safe to run multiple times (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
-- ════════════════════════════════════════════════════════════════════

-- ─── 1. WORK LOGS (Employees page) ──────────────────────────────
CREATE TABLE IF NOT EXISTS work_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  work_type TEXT,
  location TEXT,
  hours NUMERIC DEFAULT 0,
  amount NUMERIC DEFAULT 0,
  notes TEXT,
  status TEXT DEFAULT 'Completed',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE work_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "work_logs_all" ON work_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── 2. CLIENT MEETINGS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  meeting_date DATE NOT NULL,
  meeting_time TEXT,
  mom TEXT,
  action_items TEXT,
  next_meeting_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE client_meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "client_meetings_all" ON client_meetings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── 3. CLIENT SERVICES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE client_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "client_services_all" ON client_services FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── 4. CLIENT SHOOTS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_shoots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  date DATE,
  reporting_time TEXT,
  location TEXT,
  assigned_employees UUID[] DEFAULT '{}',
  notes TEXT,
  status TEXT DEFAULT 'Scheduled',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE client_shoots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "client_shoots_all" ON client_shoots FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── 5. CLIENT POSTS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  date DATE,
  platform TEXT DEFAULT 'Instagram',
  post_type TEXT DEFAULT 'Image',
  caption TEXT,
  status TEXT DEFAULT 'Draft',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE client_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "client_posts_all" ON client_posts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── 6. PAYMENT HISTORY ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  invoice_no TEXT,
  date DATE NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'Paid',
  payment_mode TEXT DEFAULT 'Cash',
  cheque_no TEXT,
  transaction_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payment_history_all" ON payment_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── 7. CLIENT ASSIGNMENTS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id, employee_id)
);
ALTER TABLE client_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "client_assignments_all" ON client_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── 8. COMM LOGS (Lead communication) ──────────────────────────
CREATE TABLE IF NOT EXISTS comm_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  method TEXT,
  summary TEXT,
  action_items TEXT,
  datetime TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE comm_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comm_logs_all" ON comm_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── 9. LEAD TASKS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  description TEXT,
  due_date DATE,
  status TEXT DEFAULT 'Pending',
  assigned_to TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE lead_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lead_tasks_all" ON lead_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── 10. LEAD SERVICES ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  service_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE lead_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lead_services_all" ON lead_services FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── 11. RECOVERY REMINDERS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS recovery_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID REFERENCES quotations(id) ON DELETE CASCADE,
  type TEXT,
  message TEXT,
  sent_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE recovery_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recovery_reminders_all" ON recovery_reminders FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── 12. RECOVERY NOTES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recovery_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID REFERENCES quotations(id) ON DELETE CASCADE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE recovery_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recovery_notes_all" ON recovery_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── 13. SMART LEADS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS smart_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  email TEXT,
  phone TEXT,
  whatsapp TEXT,
  organization TEXT,
  source TEXT,
  message TEXT,
  status TEXT DEFAULT 'New',
  assigned_to UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE smart_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "smart_leads_all" ON smart_leads FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── 14. EXPENSES ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  amount NUMERIC DEFAULT 0,
  category TEXT DEFAULT 'Other',
  date DATE DEFAULT CURRENT_DATE,
  description TEXT,
  project_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expenses_all" ON expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── 15. CALENDAR EVENTS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  type TEXT DEFAULT 'Meeting',
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  client_name TEXT,
  client_id UUID,
  status TEXT DEFAULT 'Scheduled',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "calendar_events_all" ON calendar_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── 16. CALENDAR EVENT ASSIGNMENTS ─────────────────────────────
CREATE TABLE IF NOT EXISTS calendar_event_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES calendar_events(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE calendar_event_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "calendar_event_assignments_all" ON calendar_event_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── 17. QUOTATION ITEMS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quotation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID REFERENCES quotations(id) ON DELETE CASCADE,
  service_name TEXT,
  description TEXT,
  quantity NUMERIC DEFAULT 1,
  rate NUMERIC DEFAULT 0,
  amount NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quotation_items_all" ON quotation_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════
-- MISSING COLUMNS on existing tables (safe — IF NOT EXISTS)
-- ═══════════════════════════════════════════════════════════════

-- Clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS total_billed NUMERIC DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS outstanding NUMERIC DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS assigned_employees UUID[] DEFAULT '{}';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS whatsapp TEXT;

-- Employees table
ALTER TABLE employees ADD COLUMN IF NOT EXISTS on_field_today BOOLEAN DEFAULT false;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS target NUMERIC DEFAULT 50;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS salary NUMERIC DEFAULT 0;

-- Leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_followup_date DATE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_call_date DATE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS heat TEXT DEFAULT 'Warm';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_interaction_date DATE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS action_item TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS quotation_status TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lifecycle_stage TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS payment_status TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS payment_due_date DATE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS estimated_value NUMERIC DEFAULT 0;

-- Quotations table
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS quote_number TEXT;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'Quotation';
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS date DATE;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS valid_until DATE;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS client_id UUID;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS lead_id UUID;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS client_phone TEXT;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS subtotal NUMERIC DEFAULT 0;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS discount_percent NUMERIC DEFAULT 0;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS discount_type TEXT DEFAULT 'percent';
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS gst_applicable BOOLEAN DEFAULT false;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS gst_rate NUMERIC DEFAULT 0;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS cgst NUMERIC DEFAULT 0;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS sgst NUMERIC DEFAULT 0;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS gst_amount NUMERIC DEFAULT 0;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS grand_total NUMERIC DEFAULT 0;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS terms TEXT;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS internal_notes TEXT;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS bank_details TEXT;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS upi_id TEXT;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS is_bill BOOLEAN DEFAULT false;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS amount_paid NUMERIC DEFAULT 0;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS total_amount NUMERIC DEFAULT 0;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS issue_date DATE;

-- Partners table
ALTER TABLE partners ADD COLUMN IF NOT EXISTS partner_type TEXT DEFAULT 'Individual';
ALTER TABLE partners ADD COLUMN IF NOT EXISTS commission_rate NUMERIC DEFAULT 10;

-- Partner sub-tables
CREATE TABLE IF NOT EXISTS partner_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES partners(id) ON DELETE CASCADE,
  lead_name TEXT,
  lead_phone TEXT,
  status TEXT DEFAULT 'New',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE partner_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "partner_leads_all" ON partner_leads FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS partner_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES partners(id) ON DELETE CASCADE,
  commission_amount NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'Pending',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE partner_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "partner_ledger_all" ON partner_ledger FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'Active',
  budget NUMERIC DEFAULT 0,
  spent NUMERIC DEFAULT 0,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "projects_all" ON projects FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════
-- DONE! All tables and columns are now synced with the app.
-- ═══════════════════════════════════════════════════════════════
