-- ==============================================================================
-- CreativeMark CRM Database Schema Update V2
-- Run this script inside the Supabase SQL Editor AFTER the initial schema
-- ==============================================================================

-- 1. Add service_type to clients (replaces mandatory monthly_retainer)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS service_type TEXT;

-- 2. Add custom_role to employees (for "Others" role option)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS custom_role TEXT;
-- Add salary column (fixing the schema cache error)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS salary NUMERIC(10, 2) DEFAULT 0;

-- 3. Add lifecycle fields to leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_interaction_date DATE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS action_item TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_call_date DATE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS quotation_status TEXT CHECK (quotation_status IN ('Not Sent', 'Sent', 'Accepted', 'Rejected')) DEFAULT 'Not Sent';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS quotation_id UUID REFERENCES quotations(id) ON DELETE SET NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS bill_id UUID REFERENCES quotations(id) ON DELETE SET NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS payment_due_date DATE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS payment_status TEXT CHECK (payment_status IN ('Not Due', 'Pending', 'Paid', 'Overdue')) DEFAULT 'Not Due';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lifecycle_stage TEXT CHECK (lifecycle_stage IN ('Lead', 'Quotation', 'Negotiation', 'Billing', 'Payment', 'Completed', 'Lost')) DEFAULT 'Lead';

-- 4. Add description column to quotation_items (missing)
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS description TEXT;

-- 5. Add internal_notes and terms columns to quotations (missing)
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS internal_notes TEXT;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS terms TEXT;

-- 6. Create lead_calls table for tracking multiple calls
CREATE TABLE IF NOT EXISTS lead_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    call_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    duration_minutes INTEGER DEFAULT 0,
    summary TEXT,
    outcome TEXT,
    next_action TEXT,
    called_by UUID REFERENCES employees(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 7. Create notifications table for scheduled notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT,
    trigger_date DATE NOT NULL,
    is_read BOOLEAN DEFAULT false,
    notification_type TEXT CHECK (notification_type IN ('follow_up', 'payment_due', 'quotation_reminder', 'call_reminder')) DEFAULT 'follow_up',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 8. Fix RLS Policies — Add INSERT/UPDATE/DELETE policies for all tables

-- CLIENTS: Allow authenticated users to insert
CREATE POLICY "Authenticated users can insert clients" ON clients
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- CLIENTS: Allow authenticated users to update their assigned clients or admins
CREATE POLICY "Authenticated users can update clients" ON clients
    FOR UPDATE USING (
        (auth.uid() IN (SELECT id FROM employees WHERE role = 'Admin')) OR
        (id IN (SELECT client_id FROM client_assignments WHERE employee_id = auth.uid()))
    );

-- CLIENTS: Admins can delete
CREATE POLICY "Admins can delete clients" ON clients
    FOR DELETE USING (auth.uid() IN (SELECT id FROM employees WHERE role = 'Admin'));

-- LEADS: Allow authenticated users to insert
CREATE POLICY "Authenticated users can insert leads" ON leads
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- LEADS: Allow assigned or admin to update
CREATE POLICY "Assigned users or admins can update leads" ON leads
    FOR UPDATE USING (
        (auth.uid() IN (SELECT id FROM employees WHERE role = 'Admin')) OR 
        (assigned_to = auth.uid())
    );

-- LEADS: Admins can delete
CREATE POLICY "Admins can delete leads" ON leads
    FOR DELETE USING (auth.uid() IN (SELECT id FROM employees WHERE role = 'Admin'));

-- EMPLOYEES: Allow admins to insert
CREATE POLICY "Admins can insert employees" ON employees
    FOR INSERT WITH CHECK (
        auth.uid() IN (SELECT id FROM employees WHERE role = 'Admin')
    );

-- EMPLOYEES: Allow admins to update
CREATE POLICY "Admins can update employees" ON employees
    FOR UPDATE USING (
        auth.uid() IN (SELECT id FROM employees WHERE role = 'Admin') OR auth.uid() = id
    );

-- CLIENT_ASSIGNMENTS: Full access for authenticated users
CREATE POLICY "Authenticated users can manage client assignments" ON client_assignments
    FOR ALL USING (auth.uid() IS NOT NULL);

-- QUOTATIONS: Allow authenticated to insert
CREATE POLICY "Authenticated users can insert quotations" ON quotations
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- WORK_LOGS: Allow authenticated to insert
CREATE POLICY "Authenticated users can insert work logs" ON work_logs
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Enable RLS on new tables
ALTER TABLE lead_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Lead calls: accessible by authenticated users
CREATE POLICY "Authenticated users can manage lead calls" ON lead_calls
    FOR ALL USING (auth.uid() IS NOT NULL);

-- Notifications: users see their own
CREATE POLICY "Users see own notifications" ON notifications
    FOR ALL USING (user_id = auth.uid() OR auth.uid() IN (SELECT id FROM employees WHERE role = 'Admin'));

-- Enable RLS on child tables if not already
ALTER TABLE client_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shoot_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE shoot_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE comm_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_commission_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_notes ENABLE ROW LEVEL SECURITY;

-- Open policies for child tables (authenticated users)
CREATE POLICY "Authenticated access to client_services" ON client_services FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated access to social_posts" ON social_posts FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated access to shoot_schedules" ON shoot_schedules FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated access to shoot_assignments" ON shoot_assignments FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated access to payment_entries" ON payment_entries FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated access to salary_payments" ON salary_payments FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated access to lead_services" ON lead_services FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated access to comm_logs" ON comm_logs FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated access to lead_tasks" ON lead_tasks FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated access to quotation_items" ON quotation_items FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated access to partner_commission_rates" ON partner_commission_rates FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated access to partner_leads" ON partner_leads FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated access to partner_ledger" ON partner_ledger FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated access to recovery_reminders" ON recovery_reminders FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated access to recovery_notes" ON recovery_notes FOR ALL USING (auth.uid() IS NOT NULL);
