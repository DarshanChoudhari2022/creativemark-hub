-- ==============================================================================
-- Phase 2: Financial Intelligence & Expense Tracking
-- ==============================================================================

-- 1. Create expenses table
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    category TEXT CHECK (category IN ('Salary', 'Rent', 'Software', 'Marketing', 'Hardware', 'Travel', 'Other')) DEFAULT 'Other',
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL, -- Link expense to a specific project
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Add budget_revenue to projects (for profitability tracking if different from quotation)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS budget_cost NUMERIC(15, 2) DEFAULT 0;

-- 3. Enable RLS
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
CREATE POLICY "Authenticated users can manage expenses" ON expenses
    FOR ALL USING (auth.uid() IS NOT NULL);

-- 5. Trigger for updated_at
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
