-- ═══════════════════════════════════════════════════════════════════════════════
-- FIX: Allow CRM admin (any authenticated user) to READ all field-app tables
-- 
-- Problem: RLS policies only allow employees to see their own rows.
--          The CRM admin hub user can't see any shifts/employees/visits.
--
-- Solution: Add SELECT policies for authenticated users on all field tables.
--           Supabase RLS is additive (OR), so this won't break existing
--           "select own" policies used by the field app.
--
-- Run this in: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. employee_shifts — Shifts & Attendance page
DROP POLICY IF EXISTS "shifts_admin_read_all" ON public.employee_shifts;
CREATE POLICY "shifts_admin_read_all" ON public.employee_shifts
  FOR SELECT USING (auth.role() = 'authenticated');

-- 2. employees — Employee list, dropdowns, all pages referencing employees
DROP POLICY IF EXISTS "employees_admin_read_all" ON public.employees;
CREATE POLICY "employees_admin_read_all" ON public.employees
  FOR SELECT USING (auth.role() = 'authenticated');

-- 3. employee_location_history — Live Tracking page
DROP POLICY IF EXISTS "elh_admin_read_all" ON public.employee_location_history;
CREATE POLICY "elh_admin_read_all" ON public.employee_location_history
  FOR SELECT USING (auth.role() = 'authenticated');

-- 4. society_data — Verification, Field Reports pages
DROP POLICY IF EXISTS "society_admin_read_all" ON public.society_data;
CREATE POLICY "society_admin_read_all" ON public.society_data
  FOR SELECT USING (auth.role() = 'authenticated');

-- 5. assigned_societies — Assignments page
DROP POLICY IF EXISTS "assigned_admin_read_all" ON public.assigned_societies;
CREATE POLICY "assigned_admin_read_all" ON public.assigned_societies
  FOR SELECT USING (auth.role() = 'authenticated');

-- ═══════════════════════════════════════════════════════════════════════════════
-- ✅ DONE — CRM admin hub can now read all field-app data
-- ═══════════════════════════════════════════════════════════════════════════════
