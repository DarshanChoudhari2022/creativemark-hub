-- ═══════════════════════════════════════════════════════════════════
-- Lead Hunter — schema
--
-- A lead "list" groups results from one search session
-- (e.g. "Restaurants in Pune, 5km radius — Oct 12 hunt"). Each list owns
-- many `lead_hunter_leads` rows. The user can enrich + AI-score leads,
-- then promote interesting ones into the main `leads` table.
--
-- Run this once in the Supabase SQL editor.
-- ═══════════════════════════════════════════════════════════════════

-- ── Lists (search sessions) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lead_hunter_lists (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  category_key    TEXT,                    -- e.g. 'restaurant'
  category_label  TEXT,                    -- e.g. 'Restaurants'
  city            TEXT,                    -- free-text city/area
  center_lat      DOUBLE PRECISION,
  center_lon      DOUBLE PRECISION,
  radius_meters   INTEGER,
  source          TEXT NOT NULL DEFAULT 'osm',  -- 'osm' | 'google_places' | 'manual'
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS lead_hunter_lists_created_at_idx
  ON public.lead_hunter_lists (created_at DESC);

-- ── Individual leads inside a list ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lead_hunter_leads (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id           UUID NOT NULL REFERENCES public.lead_hunter_lists(id) ON DELETE CASCADE,

  -- Source identity (so we don't re-import the same OSM business twice)
  source            TEXT NOT NULL DEFAULT 'osm',
  source_id         TEXT,                   -- e.g. osm node/way id

  -- Display fields
  name              TEXT NOT NULL,
  category          TEXT,
  phone             TEXT,
  website           TEXT,
  email             TEXT,
  address_full      TEXT,
  address_city      TEXT,
  lat               DOUBLE PRECISION,
  lon               DOUBLE PRECISION,

  -- Enrichment (post-website-scrape)
  enriched          BOOLEAN NOT NULL DEFAULT FALSE,
  enriched_emails   TEXT[]   DEFAULT '{}'::TEXT[],
  enriched_phones   TEXT[]   DEFAULT '{}'::TEXT[],
  socials           JSONB    DEFAULT '{}'::JSONB,
  enriched_at       TIMESTAMPTZ,

  -- AI generation (Gemini cold-email + WhatsApp + fit score)
  ai_subject        TEXT,
  ai_email_body     TEXT,
  ai_whatsapp       TEXT,
  ai_pain_point     TEXT,
  ai_fit_score      INTEGER,                  -- 0-100
  ai_generated_at   TIMESTAMPTZ,

  -- Workflow
  status            TEXT NOT NULL DEFAULT 'new',   -- 'new' | 'starred' | 'contacted' | 'imported' | 'rejected'
  notes             TEXT,
  imported_lead_id  UUID,                          -- FK-ish to public.leads.id (no hard FK to keep migrations decoupled)

  raw_tags          JSONB    DEFAULT '{}'::JSONB,

  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS lead_hunter_leads_list_idx
  ON public.lead_hunter_leads (list_id);
CREATE INDEX IF NOT EXISTS lead_hunter_leads_status_idx
  ON public.lead_hunter_leads (status);
CREATE INDEX IF NOT EXISTS lead_hunter_leads_fit_idx
  ON public.lead_hunter_leads (ai_fit_score DESC NULLS LAST);

-- Prevent duplicates within the same list (same OSM id can appear twice
-- only if the user explicitly re-scrapes — that's fine, it'll be skipped).
CREATE UNIQUE INDEX IF NOT EXISTS lead_hunter_leads_unique_per_list
  ON public.lead_hunter_leads (list_id, source, source_id)
  WHERE source_id IS NOT NULL;

-- ── Row Level Security ────────────────────────────────────────────
ALTER TABLE public.lead_hunter_lists  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_hunter_leads  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lead_hunter_lists_owner_all" ON public.lead_hunter_lists;
CREATE POLICY "lead_hunter_lists_owner_all"
  ON public.lead_hunter_lists
  FOR ALL
  TO authenticated
  USING (created_by = auth.uid() OR created_by IS NULL)
  WITH CHECK (created_by = auth.uid() OR created_by IS NULL);

DROP POLICY IF EXISTS "lead_hunter_leads_owner_all" ON public.lead_hunter_leads;
CREATE POLICY "lead_hunter_leads_owner_all"
  ON public.lead_hunter_leads
  FOR ALL
  TO authenticated
  USING (created_by = auth.uid() OR created_by IS NULL)
  WITH CHECK (created_by = auth.uid() OR created_by IS NULL);

-- ── updated_at trigger (re-uses set_updated_at if it exists) ──────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    CREATE FUNCTION public.set_updated_at()
    RETURNS TRIGGER AS $f$
    BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
    $f$ LANGUAGE plpgsql;
  END IF;
END $$;

DROP TRIGGER IF EXISTS lead_hunter_lists_updated_at ON public.lead_hunter_lists;
CREATE TRIGGER lead_hunter_lists_updated_at
  BEFORE UPDATE ON public.lead_hunter_lists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS lead_hunter_leads_updated_at ON public.lead_hunter_leads;
CREATE TRIGGER lead_hunter_leads_updated_at
  BEFORE UPDATE ON public.lead_hunter_leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
