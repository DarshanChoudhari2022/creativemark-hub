-- Adds location tracking columns to employees
ALTER TABLE employees ADD COLUMN IF NOT EXISTS current_lat NUMERIC;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS current_lng NUMERIC;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS last_location_update TIMESTAMPTZ;

-- Creates the historical location table for drawing the map
CREATE TABLE IF NOT EXISTS employee_location_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    lat NUMERIC,
    lng NUMERIC,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Setup permissions
ALTER TABLE employee_location_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all_location_history" ON employee_location_history;
CREATE POLICY "auth_all_location_history" ON employee_location_history FOR ALL USING (auth.role() = 'authenticated');

-- Setup table for society data if it's missing since Log Visit screen uses it
CREATE TABLE IF NOT EXISTS society_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    contact_person TEXT,
    contact_phone TEXT,
    number_of_flats INTEGER,
    status TEXT DEFAULT 'Pending',
    lat NUMERIC,
    lng NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE society_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all_society_data" ON society_data;
CREATE POLICY "auth_all_society_data" ON society_data FOR ALL USING (auth.role() = 'authenticated');
