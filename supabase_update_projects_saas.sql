ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_type TEXT CHECK (project_type IN ('Client Project', 'Inhouse SaaS')) DEFAULT 'Client Project';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS features_summary TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_link TEXT;
