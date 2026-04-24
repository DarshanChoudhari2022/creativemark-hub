-- ═══════════════════════════════════════════════════════════
-- Payment History Enhancement — Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- Add payment mode tracking columns
ALTER TABLE payment_history ADD COLUMN IF NOT EXISTS payment_mode TEXT DEFAULT 'Cash';
ALTER TABLE payment_history ADD COLUMN IF NOT EXISTS cheque_no TEXT;
ALTER TABLE payment_history ADD COLUMN IF NOT EXISTS transaction_id TEXT;

-- Ensure client_services table exists for service management
CREATE TABLE IF NOT EXISTS client_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  monthly_rate NUMERIC DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Recovery tracking tables (if not already created)
CREATE TABLE IF NOT EXISTS recovery_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID,
  type TEXT DEFAULT 'whatsapp',
  message TEXT,
  sent_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recovery_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
