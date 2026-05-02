-- ==============================================================================
-- Extra Charges & Sale-level Expenses for project_sales (a.k.a. product sales)
-- Run in Supabase SQL Editor.
-- Adds three nullable / defaulted columns so existing inserts continue to work.
-- ==============================================================================

ALTER TABLE project_sales
  ADD COLUMN IF NOT EXISTS extra_charges NUMERIC(12, 2) DEFAULT 0;

ALTER TABLE project_sales
  ADD COLUMN IF NOT EXISTS sale_expenses NUMERIC(12, 2) DEFAULT 0;

ALTER TABLE project_sales
  ADD COLUMN IF NOT EXISTS expense_notes TEXT;

-- Backfill nulls (in case someone already added the columns without defaults)
UPDATE project_sales SET extra_charges  = 0 WHERE extra_charges  IS NULL;
UPDATE project_sales SET sale_expenses  = 0 WHERE sale_expenses  IS NULL;

-- Helpful indexes for the dashboard product-wise + monthly aggregates
CREATE INDEX IF NOT EXISTS idx_project_sales_project_id   ON project_sales (project_id);
CREATE INDEX IF NOT EXISTS idx_project_sales_sale_date    ON project_sales (sale_date);
