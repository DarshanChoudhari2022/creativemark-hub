const { createClient } = require('@supabase/supabase-js');

const SERVICE_ROLE_KEY = process.argv[2];
if (!SERVICE_ROLE_KEY) { console.error('Usage: node fix_darshan_auth.cjs SERVICE_ROLE_KEY'); process.exit(1); }

const supabase = createClient(
  'https://kswuwswgmgljpsvrnpbu.supabase.co',
  SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

async function fix() {
  const email = 'choudharidarshan556@gmail.com';
  const password = 'Creative@123';

  // 1. Create confirmed auth user via admin API
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Darshan Choudhari' }
  });

  if (error) {
    console.error('Failed to create auth user:', error.message);
    return;
  }

  const newId = data.user.id;
  console.log('Auth user created:', newId);

  // 2. Find the old employee ID
  const { data: emp } = await supabase
    .from('employees')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (!emp) {
    console.error('Employee not found for email:', email);
    return;
  }

  const oldId = emp.id;
  if (oldId === newId) {
    console.log('IDs already match — nothing to migrate.');
    return;
  }

  console.log('Old ID:', oldId, '→ New ID:', newId);

  // 3. SAFE: Migrate all child table references BEFORE touching the employee row
  const childTables = [
    { table: 'work_logs', col: 'employee_id' },
    { table: 'client_assignments', col: 'employee_id' },
    { table: 'employee_location_history', col: 'employee_id' },
    { table: 'employee_shifts', col: 'employee_id' },
    { table: 'society_data', col: 'employee_id' },
    { table: 'assigned_societies', col: 'employee_id' },
    { table: 'salary_payments', col: 'employee_id' },
    { table: 'leads', col: 'assigned_to' },
  ];

  console.log('\nMigrating child table references...');
  for (const { table, col } of childTables) {
    const { error: err } = await supabase.from(table).update({ [col]: newId }).eq(col, oldId);
    console.log(`  ${table}: ${err ? err.message : '✓'}`);
  }

  // 4. Copy employee row with new ID, then delete old (safe — no child FKs left)
  const { data: fullEmp } = await supabase.from('employees').select('*').eq('id', oldId).single();
  if (fullEmp) {
    const { id: _drop, ...rest } = fullEmp;
    const { error: insErr } = await supabase.from('employees').insert({ ...rest, id: newId });
    if (insErr) {
      console.error('Insert new record failed:', insErr.message);
      return;
    }
    await supabase.from('employees').delete().eq('id', oldId);
    console.log('Employee record migrated to new auth ID');
  }

  console.log('\nDarshan can now log in with:');
  console.log('  Email:', email);
  console.log('  Password:', password);
}

fix();
