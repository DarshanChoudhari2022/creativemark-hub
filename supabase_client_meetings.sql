-- ═══════════════════════════════════════════════════════════
-- Client Meetings Table — Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

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

CREATE POLICY "Allow all for authenticated" ON client_meetings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
