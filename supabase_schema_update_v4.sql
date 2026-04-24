-- ==============================================================================
-- Schema Update v4: Automatic Project Status & Task Time Tracking
-- ==============================================================================

-- 1. Add time tracking to project_tasks
ALTER TABLE project_tasks 
ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS actual_hours NUMERIC(10, 2) DEFAULT 0;

-- 2. Enhanced function to update project status and progress
CREATE OR REPLACE FUNCTION update_project_stats()
RETURNS TRIGGER AS $$
DECLARE
    v_total_tasks INTEGER;
    v_completed_tasks INTEGER;
    v_new_progress INTEGER;
    v_all_completed BOOLEAN;
BEGIN
    -- Get counts for the project
    SELECT 
        COUNT(*), 
        COUNT(*) FILTER (WHERE status = 'Completed'),
        COUNT(*) = COUNT(*) FILTER (WHERE status = 'Completed')
    INTO v_total_tasks, v_completed_tasks, v_all_completed
    FROM project_tasks
    WHERE project_id = COALESCE(NEW.project_id, OLD.project_id);

    -- Calculate progress percentage
    IF v_total_tasks > 0 THEN
        v_new_progress := (v_completed_tasks * 100) / v_total_tasks;
    ELSE
        v_new_progress := 0;
    END IF;

    -- Update project progress and status if all completed
    IF v_all_completed AND v_total_tasks > 0 THEN
        UPDATE projects 
        SET progress = v_new_progress,
            status = 'Completed'
        WHERE id = COALESCE(NEW.project_id, OLD.project_id)
        AND status != 'Completed';
    ELSE
        UPDATE projects 
        SET progress = v_new_progress
        WHERE id = COALESCE(NEW.project_id, OLD.project_id);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Replace the previous trigger
DROP TRIGGER IF EXISTS update_project_progress ON project_tasks;
CREATE TRIGGER update_project_stats_trigger
AFTER INSERT OR UPDATE OR DELETE ON project_tasks
FOR EACH ROW EXECUTE PROCEDURE update_project_stats();
