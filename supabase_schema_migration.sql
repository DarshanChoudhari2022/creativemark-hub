-- ==============================================================================
-- CreativeMark CRM Database Schema for Supabase
-- Run this script inside the Supabase SQL Editor
-- ==============================================================================

-- 1. Create Enums
CREATE TYPE client_category AS ENUM ('Politician', 'Clothing', 'Motors', 'Other', 'Unknown');
CREATE TYPE payment_status AS ENUM ('Paid', 'Partial', 'Overdue', 'Pending');
CREATE TYPE client_status AS ENUM ('Active', 'Inactive');
CREATE TYPE post_type AS ENUM ('Reel', 'Graphic', 'Story', 'Video');
CREATE TYPE platform AS ENUM ('Instagram', 'Facebook', 'YouTube', 'Twitter/X', 'LinkedIn');
CREATE TYPE post_status AS ENUM ('Planned', 'Designed', 'Approved', 'Posted');
CREATE TYPE shoot_type AS ENUM ('Reel', 'Photo', 'Video');
CREATE TYPE shoot_status AS ENUM ('Scheduled', 'Completed', 'Cancelled');
CREATE TYPE employee_role AS ENUM (
  'Admin',
  'Employee',
  'Reel Shooter',
  'Graphic Designer',
  'Photographer',
  'Videographer',
  'Video Editor',
  'Banner Designer',
  'Social Media Manager',
  'Content Writer',
  'Sales Executive',
  'Campaign Strategist',
  'Project Manager'
);
CREATE TYPE employee_status AS ENUM ('Active', 'On Leave', 'Inactive');
CREATE TYPE contract_type AS ENUM ('Per Assignment', 'Monthly');
CREATE TYPE work_type AS ENUM (
  'Reel Shoot',
  'Video Shoot',
  'Photography',
  'Banner Work',
  'Graphic Design',
  'Event Coverage',
  'Office Work',
  'Other'
);
CREATE TYPE work_log_status AS ENUM ('Completed', 'Scheduled', 'Cancelled');
CREATE TYPE lead_stage AS ENUM ('New', 'Contacted', 'Quotation Sent', 'Negotiation', 'Converted', 'Lost');
CREATE TYPE lead_heat AS ENUM ('Hot', 'Warm', 'Cold');
CREATE TYPE lead_source AS ENUM ('WhatsApp', 'Referral', 'Cold Call', 'Instagram', 'Facebook', 'Walk-in', 'Website', 'Partner', 'Other');
CREATE TYPE contact_method AS ENUM ('Call', 'WhatsApp', 'Meeting', 'Email');
CREATE TYPE task_status AS ENUM ('Pending', 'Done');
CREATE TYPE quotation_type AS ENUM ('Quotation', 'Bill');
CREATE TYPE quotation_status AS ENUM ('Draft', 'Sent', 'Approved', 'Converted to Bill', 'Paid', 'Overdue', 'Rejected');
CREATE TYPE payment_method_type AS ENUM ('Cash', 'UPI', 'Bank Transfer', 'Cheque');

-- 2. Create Core Tables

-- EMPLOYEES
CREATE TABLE employees (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role employee_role NOT NULL DEFAULT 'Employee',
    phone TEXT,
    whatsapp TEXT,
    email TEXT,
    address TEXT,
    emergency_contact TEXT,
    aadhar TEXT,
    bank_account TEXT,
    ifsc TEXT,
    account_holder TEXT,
    bank_name TEXT,
    upi TEXT,
    contract_type contract_type DEFAULT 'Monthly',
    base_rate NUMERIC(10, 2) DEFAULT 0,
    date_joined DATE DEFAULT CURRENT_DATE,
    notes TEXT,
    status employee_status DEFAULT 'Active',
    on_field_today BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- CLIENTS
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category client_category DEFAULT 'Other',
    area TEXT,
    contact_person TEXT,
    phone TEXT,
    whatsapp TEXT,
    email TEXT,
    address TEXT,
    gst TEXT,
    pan TEXT,
    contract_start DATE DEFAULT CURRENT_DATE,
    contract_end DATE,
    monthly_retainer NUMERIC(10, 2) DEFAULT 0,
    notes TEXT,
    partner_id UUID,
    status client_status DEFAULT 'Active',
    payment_status payment_status DEFAULT 'Paid',
    total_billed NUMERIC(12, 2) DEFAULT 0,
    outstanding NUMERIC(12, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- CLIENT EMPLOYEES (Many-to-Many Assignments)
CREATE TABLE client_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(client_id, employee_id)
);

-- CLIENT SERVICES
CREATE TABLE client_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    service_name TEXT NOT NULL,
    monthly_rate NUMERIC(10, 2) DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- SOCIAL POSTS
CREATE TABLE social_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    post_type post_type NOT NULL,
    platform platform NOT NULL,
    caption TEXT,
    designed_by UUID REFERENCES employees(id) ON DELETE SET NULL,
    client_approved BOOLEAN DEFAULT false,
    posted BOOLEAN DEFAULT false,
    status post_status DEFAULT 'Planned',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- SHOOT SCHEDULES
CREATE TABLE shoot_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    shoot_type shoot_type NOT NULL,
    location TEXT,
    reporting_time TIME,
    end_time TIME,
    status shoot_status DEFAULT 'Scheduled',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- SHOOT ASSIGNMENTS
CREATE TABLE shoot_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shoot_id UUID REFERENCES shoot_schedules(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    UNIQUE(shoot_id, employee_id)
);

-- PAYMENT ENTRIES
CREATE TABLE payment_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    invoice_no TEXT,
    date DATE NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    status payment_status DEFAULT 'Pending',
    payment_date DATE,
    payment_method payment_method_type,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- WORK LOGS
CREATE TABLE work_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    work_type work_type NOT NULL,
    reporting_time TIME,
    end_time TIME,
    location TEXT,
    agreed_amount NUMERIC(10, 2) DEFAULT 0,
    notes TEXT,
    status work_log_status DEFAULT 'Completed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- SALARY PAYMENTS
CREATE TABLE salary_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    year INTEGER NOT NULL,
    total_assignments INTEGER DEFAULT 0,
    total_earned NUMERIC(10, 2) DEFAULT 0,
    amount_paid NUMERIC(10, 2) DEFAULT 0,
    amount_pending NUMERIC(10, 2) DEFAULT 0,
    payment_date DATE,
    payment_method payment_method_type,
    reference TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(employee_id, month, year)
);

-- LEADS
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    organization TEXT,
    category client_category DEFAULT 'Unknown',
    phone TEXT,
    whatsapp TEXT,
    email TEXT,
    address TEXT,
    constituency TEXT,
    source lead_source DEFAULT 'Other',
    referrer_name TEXT,
    referrer_phone TEXT,
    partner_id UUID,
    assigned_to UUID REFERENCES employees(id) ON DELETE SET NULL,
    stage lead_stage DEFAULT 'New',
    heat lead_heat DEFAULT 'Warm',
    estimated_value NUMERIC(12, 2) DEFAULT 0,
    date_received DATE DEFAULT CURRENT_DATE,
    expected_close DATE,
    last_contact_date DATE,
    next_followup_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- LEAD SERVICES INTERESTED
CREATE TABLE lead_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    service_name TEXT NOT NULL
);

-- COMM LOGS (Lead Communication)
CREATE TABLE comm_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    contact_person_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    method contact_method NOT NULL,
    summary TEXT NOT NULL,
    action_items TEXT,
    pending_items TEXT,
    next_followup_date DATE,
    next_followup_assigned_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- LEAD TASKS
CREATE TABLE lead_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    assigned_to_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    due_date DATE,
    status task_status DEFAULT 'Pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- QUOTATIONS & BILLS
CREATE TABLE quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_number TEXT UNIQUE NOT NULL,
    type quotation_type DEFAULT 'Quotation',
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    client_name TEXT,
    client_address TEXT,
    client_phone TEXT,
    client_email TEXT,
    client_gst TEXT,
    date DATE DEFAULT CURRENT_DATE,
    valid_until DATE,
    due_date DATE,
    subtotal NUMERIC(12, 2) DEFAULT 0,
    discount_percent NUMERIC(5, 2) DEFAULT 0,
    discount_amount NUMERIC(12, 2) DEFAULT 0,
    discount_type TEXT CHECK (discount_type IN ('percent', 'flat')),
    gst_applicable BOOLEAN DEFAULT false,
    gst_rate NUMERIC(5, 2) DEFAULT 18,
    cgst NUMERIC(12, 2) DEFAULT 0,
    sgst NUMERIC(12, 2) DEFAULT 0,
    gst_amount NUMERIC(12, 2) DEFAULT 0,
    grand_total NUMERIC(12, 2) DEFAULT 0,
    status quotation_status DEFAULT 'Draft',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- QUOTATION ITEMS
CREATE TABLE quotation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID REFERENCES quotations(id) ON DELETE CASCADE,
    service_name TEXT NOT NULL,
    quantity NUMERIC(10, 2) DEFAULT 1,
    unit TEXT,
    rate NUMERIC(12, 2) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL
);

-- PARTNERS
CREATE TABLE partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    business_name TEXT,
    phone TEXT,
    whatsapp TEXT,
    email TEXT,
    address TEXT,
    pan TEXT,
    bank_account TEXT,
    ifsc TEXT,
    account_holder TEXT,
    bank_name TEXT,
    upi TEXT,
    partner_since DATE DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'Active',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- PARTNER COMMISSION RATES
CREATE TABLE partner_commission_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID REFERENCES partners(id) ON DELETE CASCADE,
    service_name TEXT NOT NULL,
    default_percent NUMERIC(5, 2) DEFAULT 0,
    partner_percent NUMERIC(5, 2) DEFAULT 0,
    notes TEXT
);

-- PARTNER LEADS (Referred Leads)
CREATE TABLE partner_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID REFERENCES partners(id) ON DELETE CASCADE,
    lead_name TEXT NOT NULL,
    date_referred DATE DEFAULT CURRENT_DATE,
    current_stage lead_stage DEFAULT 'New',
    converted BOOLEAN DEFAULT false,
    deal_value NUMERIC(12, 2) DEFAULT 0,
    commission NUMERIC(12, 2) DEFAULT 0,
    status TEXT DEFAULT 'Pending'
);

-- PARTNER LEDGER
CREATE TABLE partner_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID REFERENCES partners(id) ON DELETE CASCADE,
    date DATE DEFAULT CURRENT_DATE,
    client_name TEXT,
    invoice_number TEXT,
    service_name TEXT,
    invoice_amount NUMERIC(12, 2) DEFAULT 0,
    commission_percent NUMERIC(5, 2) DEFAULT 0,
    commission_amount NUMERIC(12, 2) DEFAULT 0,
    status TEXT DEFAULT 'Pending',
    payment_date DATE,
    reference TEXT,
    notes TEXT
);

-- RECOVERY REMINDERS
CREATE TABLE recovery_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID REFERENCES quotations(id) ON DELETE CASCADE,
    type reminder_type,
    template_used TEXT,
    sent_by TEXT,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    notes TEXT
);

-- RECOVERY NOTES
CREATE TABLE recovery_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID REFERENCES quotations(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 3. Row Level Security (RLS) Enablement
-- ==============================================================================

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 4. Basic RLS Policies
-- ==============================================================================

-- Employees can read all employees, but only Admins can write
CREATE POLICY "Employees can read all employees" ON employees
    FOR SELECT USING (true);
    
-- Employees can view leads assigned to them. Admins see all.
CREATE POLICY "View Leads based on Assignment" ON leads
    FOR SELECT 
    USING (
        (auth.uid() IN (SELECT id FROM employees WHERE role = 'Admin')) OR 
        (assigned_to = auth.uid())
    );

-- Employees can only view clients they are assigned to. Admins see all.
CREATE POLICY "View Clients based on Assignment" ON clients
    FOR SELECT 
    USING (
        (auth.uid() IN (SELECT id FROM employees WHERE role = 'Admin')) OR 
        (id IN (SELECT client_id FROM client_assignments WHERE employee_id = auth.uid()))
    );

-- WorkLogs belong to the employee
CREATE POLICY "Employee can manage their own work logs" ON work_logs
    FOR ALL
    USING (employee_id = auth.uid());

-- Partners: Admins see all, others nothing for now (or partners see their own)
CREATE POLICY "Admins manage partners" ON partners
    FOR ALL
    USING (auth.uid() IN (SELECT id FROM employees WHERE role = 'Admin'));

-- Quotations: Admins see all, others see what they need
CREATE POLICY "Admins manage quotations" ON quotations
    FOR ALL
    USING (auth.uid() IN (SELECT id FROM employees WHERE role = 'Admin'));
