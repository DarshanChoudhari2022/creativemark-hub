-- ═══════════════════════════════════════════════════════════
-- Smart Lead Notification System — Database Schema
-- Tables: smart_leads, sales_roster, lead_activity_log, webhook_config
-- ═══════════════════════════════════════════════════════════

-- ── 1. smart_leads: Core lead table for dealership leads ──
CREATE TABLE IF NOT EXISTS smart_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  whatsapp TEXT DEFAULT '',
  email TEXT,
  source TEXT NOT NULL DEFAULT 'Walk-in',
  vehicle_interest TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New', 'Assigned', 'Contacted', 'Follow-up', 'Converted', 'Lost')),
  assigned_to UUID REFERENCES employees(id),
  assigned_at TIMESTAMPTZ,
  assignment_method TEXT CHECK (assignment_method IN ('auto', 'manual')),
  notification_sent BOOLEAN DEFAULT FALSE,
  first_response_at TIMESTAMPTZ,
  response_time_seconds INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. sales_roster: Track salesperson availability & capacity ──
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

-- ── 3. lead_activity_log: Audit trail of all lead events ──
CREATE TABLE IF NOT EXISTS lead_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES smart_leads(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'created', 'auto_assigned', 'manual_assigned', 'reassigned',
    'contacted', 'follow_up', 'converted', 'lost', 'escalated', 'sla_breach'
  )),
  details TEXT,
  actor_id UUID REFERENCES employees(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. webhook_config: Track integration status & stats ──
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

-- ── Indexes for performance ──
CREATE INDEX IF NOT EXISTS idx_smart_leads_status ON smart_leads(status);
CREATE INDEX IF NOT EXISTS idx_smart_leads_source ON smart_leads(source);
CREATE INDEX IF NOT EXISTS idx_smart_leads_assigned ON smart_leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_smart_leads_created ON smart_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_activity_lead ON lead_activity_log(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_activity_type ON lead_activity_log(event_type);
CREATE INDEX IF NOT EXISTS idx_sales_roster_emp ON sales_roster(employee_id);

-- ── RLS Policies ──
ALTER TABLE smart_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_roster ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_config ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access (dealership internal tool)
CREATE POLICY "smart_leads_all" ON smart_leads FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "sales_roster_all" ON sales_roster FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "lead_activity_all" ON lead_activity_log FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "webhook_config_all" ON webhook_config FOR ALL USING (auth.role() = 'authenticated');

-- Allow service role (webhooks) full access
CREATE POLICY "smart_leads_service" ON smart_leads FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "sales_roster_service" ON sales_roster FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "lead_activity_service" ON lead_activity_log FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "webhook_config_service" ON webhook_config FOR ALL USING (auth.role() = 'service_role');

-- ── Helper RPC: Increment webhook lead counter ──
CREATE OR REPLACE FUNCTION increment_webhook_leads(p_platform TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE webhook_config
  SET total_leads_received = total_leads_received + 1,
      last_received_at = NOW()
  WHERE platform = p_platform;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Seed default webhook configurations ──
INSERT INTO webhook_config (platform, webhook_url, is_active) VALUES
  ('Just Dial', '/functions/v1/justdial-webhook', FALSE),
  ('Meta Ads', '/functions/v1/meta-leads-webhook', FALSE),
  ('Google Ads', '/functions/v1/google-leads-webhook', FALSE),
  ('OEM CRM', NULL, FALSE)
ON CONFLICT (platform) DO NOTHING;

-- ── Updated timestamp trigger ──
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
