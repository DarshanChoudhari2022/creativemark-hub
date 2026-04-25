-- Enable PostGIS if needed (optional, but good for distance queries later)
-- CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Update Employees table to store their current live location
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS current_lat NUMERIC,
ADD COLUMN IF NOT EXISTS current_lng NUMERIC,
ADD COLUMN IF NOT EXISTS last_location_update TIMESTAMPTZ;

-- 2. Create a location history table to track the route of the salesperson
CREATE TABLE IF NOT EXISTS public.employee_location_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
    lat NUMERIC NOT NULL,
    lng NUMERIC NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. Create a table for the Societies data they collect on the field
CREATE TABLE IF NOT EXISTS public.society_data (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    
    society_name TEXT NOT NULL,
    address TEXT,
    contact_person TEXT,
    contact_number TEXT,
    number_of_flats INTEGER,
    status TEXT DEFAULT 'Visited', -- e.g., Visited, Interested, Follow Up
    notes TEXT,
    
    -- Location where the data was collected
    location_lat NUMERIC,
    location_lng NUMERIC
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.employee_location_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.society_data ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for Location History
-- Admins can view all history. Employees can insert their own history.
DROP POLICY IF EXISTS "Allow all to view location history" ON public.employee_location_history;
CREATE POLICY "Allow all to view location history" 
    ON public.employee_location_history FOR SELECT 
    USING (true);

DROP POLICY IF EXISTS "Allow employees to insert their location" ON public.employee_location_history;
CREATE POLICY "Allow employees to insert their location" 
    ON public.employee_location_history FOR INSERT 
    WITH CHECK (true);

-- 6. RLS Policies for Society Data
-- Admins can view and edit all. Employees can insert and view all.
DROP POLICY IF EXISTS "Allow all to view society data" ON public.society_data;
CREATE POLICY "Allow all to view society data" 
    ON public.society_data FOR SELECT 
    USING (true);

DROP POLICY IF EXISTS "Allow all to insert society data" ON public.society_data;
CREATE POLICY "Allow all to insert society data" 
    ON public.society_data FOR INSERT 
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all to update society data" ON public.society_data;
CREATE POLICY "Allow all to update society data" 
    ON public.society_data FOR UPDATE 
    USING (true);
