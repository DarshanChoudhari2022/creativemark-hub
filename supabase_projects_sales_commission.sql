-- ==============================================================================
-- Projects Sales & Commission Enhancement
-- Run in Supabase SQL Editor
-- ==============================================================================

-- 1. Add sales & commission fields to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS live_customers INTEGER DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS total_earnings NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS total_sales NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS salesperson_id UUID REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS commission_percentage NUMERIC(5, 2) DEFAULT 10;

-- 2. Create project_customers table (live customer tracking)
CREATE TABLE IF NOT EXISTS project_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    customer_email TEXT,
    customer_phone TEXT,
    company_name TEXT,
    subscription_status TEXT CHECK (subscription_status IN ('Active', 'Trial', 'Churned', 'Paused')) DEFAULT 'Active',
    plan_name TEXT,
    monthly_value NUMERIC(10, 2) DEFAULT 0,
    joined_date DATE DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Create project_sales table (individual sale records)
CREATE TABLE IF NOT EXISTS project_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES project_customers(id) ON DELETE SET NULL,
    salesperson_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    sale_date DATE DEFAULT CURRENT_DATE,
    sale_type TEXT CHECK (sale_type IN ('New', 'Renewal', 'Upgrade', 'One-time')) DEFAULT 'New',
    commission_percentage NUMERIC(5, 2) DEFAULT 10,
    commission_amount NUMERIC(12, 2) DEFAULT 0,
    payment_status TEXT CHECK (payment_status IN ('Pending', 'Paid', 'Overdue')) DEFAULT 'Pending',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. Enable RLS
ALTER TABLE project_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_sales ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
CREATE POLICY "Authenticated access to project_customers" ON project_customers
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated access to project_sales" ON project_sales
    FOR ALL USING (auth.uid() IS NOT NULL);
