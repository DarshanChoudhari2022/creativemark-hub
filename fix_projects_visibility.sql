-- Ensure projects table exists and has RLS enabled
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies that might restrict visibility
DROP POLICY IF EXISTS "Projects are viewable by everyone" ON projects;
DROP POLICY IF EXISTS "Projects are insertable by authenticated users" ON projects;
DROP POLICY IF EXISTS "Projects are updatable by authenticated users" ON projects;
DROP POLICY IF EXISTS "Projects are deletable by authenticated users" ON projects;

-- Create comprehensive permissive policies for authenticated users
CREATE POLICY "Projects are viewable by everyone"
ON projects FOR SELECT
USING (true);

CREATE POLICY "Projects are insertable by authenticated users"
ON projects FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Projects are updatable by authenticated users"
ON projects FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Projects are deletable by authenticated users"
ON projects FOR DELETE
TO authenticated
USING (true);

-- Ensure correct foreign keys and reload schema
NOTIFY pgrst, 'reload schema';
