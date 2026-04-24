-- ==============================================================================
-- Smart Lead Notification System - Real-time Alerts
-- ==============================================================================

-- 1. Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('lead_assigned', 'sla_breach', 'task_assigned', 'payment_received', 'system')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  is_read BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- 3. RLS Policies
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see their own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');

CREATE POLICY "Users can update their own notifications (mark as read)"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Function to create a lead assignment notification
CREATE OR REPLACE FUNCTION notify_lead_assignment()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.assigned_to IS NOT NULL) OR 
     (TG_OP = 'UPDATE' AND NEW.assigned_to IS NOT NULL AND (OLD.assigned_to IS NULL OR OLD.assigned_to <> NEW.assigned_to)) THEN
    
    INSERT INTO notifications (user_id, title, message, type, priority, metadata)
    VALUES (
      NEW.assigned_to,
      'New Lead Assigned ⚡',
      'You have been assigned a new lead: ' || NEW.customer_name || ' (' || NEW.source || ')',
      'lead_assigned',
      'high',
      jsonb_build_object('lead_id', NEW.id, 'source', NEW.source)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Trigger for lead assignment
DROP TRIGGER IF EXISTS tr_notify_lead_assignment ON smart_leads;
CREATE TRIGGER tr_notify_lead_assignment
  AFTER INSERT OR UPDATE OF assigned_to ON smart_leads
  FOR EACH ROW
  EXECUTE FUNCTION notify_lead_assignment();

-- 6. Helper to find managers for escalation
-- Assuming managers have a specific role or metadata in employees table
-- For now, we'll notify all employees with role 'Manager'
CREATE OR REPLACE FUNCTION notify_sla_breach()
RETURNS VOID AS $$
DECLARE
  breached_lead RECORD;
  manager_id UUID;
BEGIN
  FOR breached_lead IN 
    SELECT sl.*, e.name as salesperson_name
    FROM smart_leads sl
    JOIN employees e ON sl.assigned_to = e.id
    WHERE sl.status = 'Assigned' 
      AND sl.first_response_at IS NULL
      AND sl.assigned_at < NOW() - INTERVAL '15 minutes'
      AND NOT EXISTS (
        SELECT 1 FROM notifications 
        WHERE type = 'sla_breach' 
        AND (metadata->>'lead_id')::uuid = sl.id
      )
  LOOP
    -- Notify the assigned salesperson
    INSERT INTO notifications (user_id, title, message, type, priority, metadata)
    VALUES (
      breached_lead.assigned_to,
      'SLA Breach Warning 🚨',
      'Urgent: You haven''t responded to ' || breached_lead.customer_name || ' in over 15 minutes!',
      'sla_breach',
      'urgent',
      jsonb_build_object('lead_id', breached_lead.id)
    );

    -- Notify Managers
    FOR manager_id IN SELECT id FROM employees WHERE role = 'Manager' LOOP
      INSERT INTO notifications (user_id, title, message, type, priority, metadata)
      VALUES (
        manager_id,
        'Team SLA Breach ⚠️',
        breached_lead.salesperson_name || ' has not responded to ' || breached_lead.customer_name || ' (15 min breach)',
        'sla_breach',
        'high',
        jsonb_build_object('lead_id', breached_lead.id, 'salesperson_id', breached_lead.assigned_to)
      );
    END LOOP;
    
    -- Log activity
    INSERT INTO lead_activity_log (lead_id, event_type, details)
    VALUES (breached_lead.id, 'sla_breach', '15-minute response SLA breached. Notifications sent.');
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
