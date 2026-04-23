-- ==============================================================================
-- Smart Lead Notification System — Database Schema
-- Run in Supabase SQL Editor
-- ==============================================================================

-- 1. Sales Roster — shift, availability, territory
CREATE TABLE IF NOT EXISTS sales_roster (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  territory TEXT,
  shift_start TIME DEFAULT '09:00',
  shift_end TIME DEFAULT '18:00',
  max_daily_leads INTEGER DEFAULT 10,
  is_available BOOLEAN DEFAULT true,
  leave_start DATE,
  leave_end DATE,
  priority_order INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Smart Leads — unified inbox from all sources
CREATE TABLE IF NOT EXISTS smart_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Lead info
  customer_name TEXT NOT NULL,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  vehicle_interest TEXT,
  source TEXT CHECK (source IN ('Just Dial','Meta Ads','Google Ads','OEM CRM','Walk-in','Website','Other')) DEFAULT 'Other',
  source_lead_id TEXT,
  raw_payload JSONB,
  -- Assignment
  assigned_to UUID REFERENCES employees(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  assignment_method TEXT CHECK (assignment_method IN ('auto','manual','escalation')) DEFAULT 'auto',
  -- Response
  first_response_at TIMESTAMPTZ,
  response_time_seconds INTEGER,
  -- Status
  status TEXT CHECK (status IN ('New','Assigned','Contacted','Follow-up','Converted','Lost')) DEFAULT 'New',
  -- Notifications
  notification_sent BOOLEAN DEFAULT false,
  notification_channel TEXT,
  escalated BOOLEAN DEFAULT false,
  escalation_count INTEGER DEFAULT 0,
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Lead Activity Log — every action timestamped
CREATE TABLE IF NOT EXISTS lead_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  smart_lead_id UUID REFERENCES smart_leads(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  performed_by UUID REFERENCES employees(id) ON DELETE SET NULL,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Escalation Rules
CREATE TABLE IF NOT EXISTS escalation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name TEXT NOT NULL,
  timeout_minutes INTEGER DEFAULT 15,
  escalate_to TEXT CHECK (escalate_to IN ('next_available','manager','round_robin')) DEFAULT 'next_available',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default escalation rule
INSERT INTO escalation_rules (rule_name, timeout_minutes, escalate_to) 
VALUES ('Default 15-min escalation', 15, 'next_available')
ON CONFLICT DO NOTHING;

-- 5. Webhook Endpoints config
CREATE TABLE IF NOT EXISTS webhook_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT UNIQUE NOT NULL,
  endpoint_url TEXT,
  api_key TEXT,
  is_active BOOLEAN DEFAULT true,
  last_received_at TIMESTAMPTZ,
  total_leads_received INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert platform configs
INSERT INTO webhook_config (platform, endpoint_url, is_active) VALUES
  ('Just Dial', '/api/webhooks/justdial', true),
  ('Meta Ads', '/api/webhooks/meta', true),
  ('Google Ads', '/api/webhooks/google', true),
  ('OEM CRM', '/api/webhooks/oem', true)
ON CONFLICT (platform) DO NOTHING;

-- Enable RLS
ALTER TABLE sales_roster ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_config ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Auth access sales_roster" ON sales_roster FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth access smart_leads" ON smart_leads FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth access lead_activity_log" ON lead_activity_log FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth access escalation_rules" ON escalation_rules FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth access webhook_config" ON webhook_config FOR ALL USING (auth.uid() IS NOT NULL);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_smart_leads_status ON smart_leads(status);
CREATE INDEX IF NOT EXISTS idx_smart_leads_source ON smart_leads(source);
CREATE INDEX IF NOT EXISTS idx_smart_leads_assigned ON smart_leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_smart_leads_created ON smart_leads(created_at DESC);
