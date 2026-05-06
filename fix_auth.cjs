const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://kswuwswgmgljpsvrnpbu.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtzd3V3c3dnbWdsanBzdnJucGJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MzgyMjQsImV4cCI6MjA5MjMxNDIyNH0.1SxnTDCk3DAsFYit8yF3DzZmalz9jHaTIj141H-Xf8w', { auth: { persistSession: false } });

async function fix() {
  const { data: emps, error } = await supabase.from('employees').select('*');
  if (error) { console.error('Error fetching employees:', error); return; }
  console.log('Found employees:', emps.length);

  // All child tables that reference employees.id via foreign key
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
  
  for (const emp of emps) {
    console.log('Processing:', emp.name, emp.email);
    if (!emp.email) {
      console.log('  -> No email, skipping');
      continue;
    }
    
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: emp.email,
      password: 'Creative@123',
      options: { data: { full_name: emp.name } }
    });
    
    if (authError) {
      console.log('  -> SignUp error (maybe exists?):', authError.message);
      continue;
    }

    if (!authData.user) continue;

    const newId = authData.user.id;
    const oldId = emp.id;
    console.log('  -> Created auth user:', newId);

    if (newId === oldId) {
      console.log('  -> IDs already match, no migration needed');
      continue;
    }

    // SAFE: Migrate all child table references FIRST
    console.log('  -> Migrating child references...');
    for (const { table, col } of childTables) {
      const { error: err } = await supabase.from(table).update({ [col]: newId }).eq(col, oldId);
      if (err) console.log(`     ${table}: ${err.message}`);
    }

    // Copy employee row with new ID, then delete old (safe — child FKs already moved)
    const { id: _drop, ...rest } = emp;
    const { error: insErr } = await supabase.from('employees').insert({ ...rest, id: newId });
    if (insErr) {
      console.error('  -> Failed to insert new record:', insErr.message);
      continue;
    }
    await supabase.from('employees').delete().eq('id', oldId);
    console.log('  -> ✓ Migrated safely');
  }
}
fix();
