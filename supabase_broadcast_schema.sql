-- ═══════════════════════════════════════════════════════════════════
-- Broadcast Hub schema
-- Stores imported personal contacts (CSV / Phone) and a log of every
-- bulk message sent (festival greetings, brochures, product launches).
-- Run this once in the Supabase SQL editor.
-- ═══════════════════════════════════════════════════════════════════

-- ── Contacts table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.broadcast_contacts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  phone         TEXT,
  whatsapp      TEXT,
  email         TEXT,
  source        TEXT NOT NULL DEFAULT 'manual',  -- 'csv' | 'phone' | 'manual'
  tags          TEXT[] DEFAULT '{}'::TEXT[],
  notes         TEXT,
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent duplicate phone numbers per user (skip if both null)
CREATE UNIQUE INDEX IF NOT EXISTS broadcast_contacts_unique_phone
  ON public.broadcast_contacts (created_by, phone)
  WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS broadcast_contacts_name_idx
  ON public.broadcast_contacts (lower(name));

CREATE INDEX IF NOT EXISTS broadcast_contacts_source_idx
  ON public.broadcast_contacts (source);

-- ── Campaigns log ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.broadcast_campaigns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  template_key    TEXT,                            -- e.g. 'DIWALI', 'CUSTOM'
  message         TEXT NOT NULL,
  channel         TEXT NOT NULL,                   -- 'whatsapp' | 'email' | 'mixed'
  recipient_count INT  NOT NULL DEFAULT 0,
  recipients      JSONB NOT NULL DEFAULT '[]'::JSONB,
  status          TEXT NOT NULL DEFAULT 'sent',    -- 'draft' | 'sent' | 'partial'
  sent_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS broadcast_campaigns_sent_at_idx
  ON public.broadcast_campaigns (sent_at DESC);

-- ── Row Level Security ────────────────────────────────────────────
ALTER TABLE public.broadcast_contacts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_campaigns ENABLE ROW LEVEL SECURITY;

-- Authenticated users can manage their own contacts
DROP POLICY IF EXISTS "broadcast_contacts_owner_all" ON public.broadcast_contacts;
CREATE POLICY "broadcast_contacts_owner_all"
  ON public.broadcast_contacts
  FOR ALL
  TO authenticated
  USING (created_by = auth.uid() OR created_by IS NULL)
  WITH CHECK (created_by = auth.uid() OR created_by IS NULL);

-- Authenticated users can manage their own campaigns
DROP POLICY IF EXISTS "broadcast_campaigns_owner_all" ON public.broadcast_campaigns;
CREATE POLICY "broadcast_campaigns_owner_all"
  ON public.broadcast_campaigns
  FOR ALL
  TO authenticated
  USING (sent_by = auth.uid() OR sent_by IS NULL)
  WITH CHECK (sent_by = auth.uid() OR sent_by IS NULL);

-- ── updated_at trigger for broadcast_contacts ─────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS broadcast_contacts_updated_at ON public.broadcast_contacts;
CREATE TRIGGER broadcast_contacts_updated_at
  BEFORE UPDATE ON public.broadcast_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
