-- ==============================================================================
-- CreativeMark CRM — Phase 2 Supplementary Migration
-- Creates the convert_quotation_to_bill RPC for transactional safety
-- ==============================================================================

CREATE OR REPLACE FUNCTION convert_quotation_to_bill(
  p_quote_id UUID,
  p_quote_number TEXT,
  p_due_date DATE
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with elevated privileges to ensure atomic update across both tables
AS $$
DECLARE
  v_lead_id UUID;
BEGIN
  -- 1. Update the quotation record
  UPDATE quotations
  SET 
    type = 'Bill',
    status = 'Sent',
    quote_number = p_quote_number,
    due_date = p_due_date
  WHERE id = p_quote_id
  RETURNING lead_id INTO v_lead_id;

  -- 2. Update the associated lead, if any
  IF v_lead_id IS NOT NULL THEN
    UPDATE leads
    SET 
      stage = 'Converted',
      lifecycle_stage = 'Converted',
      payment_status = 'Pending',
      payment_due_date = p_due_date
    WHERE id = v_lead_id;
  END IF;
END;
$$;
