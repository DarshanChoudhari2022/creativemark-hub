-- ==============================================================================
-- Schema Update v3: Project Financials & Progress
-- ==============================================================================

-- 1. Add missing columns to projects
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS budget_revenue NUMERIC(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0;

-- 2. Function to calculate project progress based on tasks
CREATE OR REPLACE FUNCTION calculate_project_progress()
RETURNS TRIGGER AS $$
DECLARE
    total_tasks INTEGER;
    completed_tasks INTEGER;
    new_progress INTEGER;
BEGIN
    -- Get counts of tasks for this project
    SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'Completed')
    INTO total_tasks, completed_tasks
    FROM project_tasks
    WHERE project_id = COALESCE(NEW.project_id, OLD.project_id);

    -- Calculate percentage
    IF total_tasks > 0 THEN
        new_progress := (completed_tasks * 100) / total_tasks;
    ELSE
        new_progress := 0;
    END IF;

    -- Update project
    UPDATE projects 
    SET progress = new_progress
    WHERE id = COALESCE(NEW.project_id, OLD.project_id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Trigger for project progress
DROP TRIGGER IF EXISTS update_project_progress ON project_tasks;
CREATE TRIGGER update_project_progress
AFTER INSERT OR UPDATE OR DELETE ON project_tasks
FOR EACH ROW EXECUTE PROCEDURE calculate_project_progress();
