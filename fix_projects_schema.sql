-- Add all potentially missing columns to the projects table, including 'title'
ALTER TABLE projects ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS quotation_id UUID REFERENCES quotations(id) ON DELETE SET NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('Planning', 'Active', 'Review', 'Completed', 'On Hold')) DEFAULT 'Planning';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS priority TEXT CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')) DEFAULT 'Medium';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC(10, 2);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS actual_hours NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_type TEXT CHECK (project_type IN ('Client Project', 'Inhouse SaaS')) DEFAULT 'Client Project';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS features_summary TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_link TEXT;

-- Refresh the schema cache in Supabase
NOTIFY pgrst, 'reload schema';
