-- ═══════════════════════════════════════════════════════════════════
-- Field Tracking v3 — Phase 2 (verification + photos + fraud stats)
--
-- Builds on supabase_field_tracking_v2.sql. Adds:
--   • Photo evidence columns on society_data
--   • A `field-evidence` Supabase Storage bucket with RLS
--     (employees can upload to their own folder; admins can read all)
--   • A view `employee_fraud_stats` aggregating real/fake counts so
--     the admin UI can render a strike score in one query.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Photo evidence on visits ───────────────────────────────────
ALTER TABLE public.society_data
  ADD COLUMN IF NOT EXISTS selfie_url       TEXT,
  ADD COLUMN IF NOT EXISTS building_photo_url TEXT;

-- ── 2. Storage bucket for photos ──────────────────────────────────
-- Public read so the admin UI can display thumbnails directly via the
-- public URL. Writes are still gated by RLS on storage.objects below.
INSERT INTO storage.buckets (id, name, public)
VALUES ('field-evidence', 'field-evidence', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Drop any prior policies for idempotency
DROP POLICY IF EXISTS "field_evidence_select_public"   ON storage.objects;
DROP POLICY IF EXISTS "field_evidence_insert_self"     ON storage.objects;
DROP POLICY IF EXISTS "field_evidence_update_self"     ON storage.objects;
DROP POLICY IF EXISTS "field_evidence_delete_admin"    ON storage.objects;

-- Anyone (incl. anon) can read — required for <img src> in admin UI.
CREATE POLICY "field_evidence_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'field-evidence');

-- Authenticated users may upload only inside a folder named after their
-- own auth.uid(). Path convention: <uid>/<visit-id>-<kind>.jpg
CREATE POLICY "field_evidence_insert_self"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'field-evidence'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "field_evidence_update_self"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'field-evidence'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── 3. Fraud / activity rollup ────────────────────────────────────
-- One row per employee with counts the admin UI needs.
CREATE OR REPLACE VIEW public.employee_fraud_stats AS
SELECT
  e.id                                                 AS employee_id,
  e.name                                               AS employee_name,
  COUNT(s.id)                                          AS total_visits,
  COUNT(s.id) FILTER (WHERE s.verification_status = 'verified_real') AS real_count,
  COUNT(s.id) FILTER (WHERE s.verification_status = 'verified_fake') AS fake_count,
  COUNT(s.id) FILTER (WHERE s.verification_status = 'unreachable')   AS unreachable_count,
  COUNT(s.id) FILTER (WHERE s.verification_status = 'pending')       AS pending_count,
  COUNT(s.id) FILTER (WHERE s.is_mock = TRUE)                        AS mock_attempts,
  CASE
    WHEN COUNT(s.id) FILTER (WHERE s.verification_status IN ('verified_real','verified_fake')) = 0
      THEN NULL
    ELSE ROUND(
      100.0 * COUNT(s.id) FILTER (WHERE s.verification_status = 'verified_fake')::numeric
            / NULLIF(COUNT(s.id) FILTER (WHERE s.verification_status IN ('verified_real','verified_fake')), 0),
      1
    )
  END                                                  AS fake_pct
FROM public.employees e
LEFT JOIN public.society_data s ON s.employee_id = e.id
GROUP BY e.id, e.name;

GRANT SELECT ON public.employee_fraud_stats TO authenticated;

-- ── 4. Helpful index for the verification queue page ──────────────
CREATE INDEX IF NOT EXISTS society_data_pending_created_idx
  ON public.society_data (created_at DESC)
  WHERE verification_status = 'pending';
