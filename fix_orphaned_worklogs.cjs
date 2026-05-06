const { createClient } = require('@supabase/supabase-js');

const SERVICE_ROLE_KEY = process.argv[2];
if (!SERVICE_ROLE_KEY) {
  console.error('Usage: node fix_orphaned_worklogs.cjs SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(
  'https://kswuwswgmgljpsvrnpbu.supabase.co',
  SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const DARSHAN_EMAIL = 'choudharidarshan556@gmail.com';

async function fix() {
  // 1. Get Darshan's current employee ID
  const { data: emp, error: empErr } = await supabase
    .from('employees')
    .select('id, name, email')
    .eq('email', DARSHAN_EMAIL)
    .maybeSingle();

  if (empErr || !emp) {
    console.error('Could not find Darshan in employees table:', empErr?.message);
    return;
  }

  console.log(`Found employee: ${emp.name} (${emp.email})`);
  console.log(`Current ID: ${emp.id}`);

  // 2. Find ALL work_logs that are orphaned (employee_id doesn't match any current employee)
  const { data: allLogs, error: logErr } = await supabase
    .from('work_logs')
    .select('id, employee_id, work_type, date, amount, hours');

  if (logErr) {
    console.error('Failed to fetch work_logs:', logErr.message);
    return;
  }

  // 3. Get all current employee IDs
  const { data: allEmps } = await supabase.from('employees').select('id');
  const validIds = new Set((allEmps || []).map(e => e.id));

  // 4. Find orphaned logs
  const orphaned = allLogs.filter(log => !validIds.has(log.employee_id));

  if (orphaned.length === 0) {
    console.log('\nNo orphaned work_logs found.');
    console.log('If Darshan\'s logs are still missing, they may have been deleted.');
    
    // Show what Darshan currently has
    const { data: darshanLogs } = await supabase
      .from('work_logs')
      .select('id, work_type, date, amount')
      .eq('employee_id', emp.id);
    console.log(`\nDarshan currently has ${(darshanLogs || []).length} work log(s):`);
    (darshanLogs || []).forEach(l => console.log(`  - ${l.date} | ${l.work_type} | ₹${l.amount}`));
    return;
  }

  console.log(`\nFound ${orphaned.length} orphaned work log(s):`);
  const oldIds = [...new Set(orphaned.map(l => l.employee_id))];
  console.log('Old employee IDs:', oldIds);
  orphaned.forEach(l => {
    console.log(`  - ${l.date} | ${l.work_type} | ${l.hours}h | ₹${l.amount} (old ID: ${l.employee_id})`);
  });

  // 5. Re-link orphaned logs to Darshan's current ID
  for (const oldId of oldIds) {
    const { error: updateErr, count } = await supabase
      .from('work_logs')
      .update({ employee_id: emp.id })
      .eq('employee_id', oldId);

    if (updateErr) {
      console.error(`  Failed to update logs from ${oldId}:`, updateErr.message);
    } else {
      console.log(`  ✓ Re-linked work_logs from ${oldId} → ${emp.id}`);
    }
  }

  // 6. Also fix other child tables that might be orphaned
  const childTables = [
    { table: 'client_assignments', col: 'employee_id' },
    { table: 'salary_payments', col: 'employee_id' },
  ];

  for (const { table, col } of childTables) {
    for (const oldId of oldIds) {
      const { error } = await supabase
        .from(table)
        .update({ [col]: emp.id })
        .eq(col, oldId);

      if (error) {
        // Table might not exist or no rows — that's fine
        console.log(`  ${table}: ${error.message || 'no rows'}`);
      } else {
        console.log(`  ✓ ${table}: re-linked from ${oldId}`);
      }
    }
  }

  // 7. Verify
  const { data: finalLogs } = await supabase
    .from('work_logs')
    .select('id, work_type, date, amount')
    .eq('employee_id', emp.id);

  console.log(`\n✓ Darshan now has ${(finalLogs || []).length} work log(s)`);
  (finalLogs || []).forEach(l => console.log(`  - ${l.date} | ${l.work_type} | ₹${l.amount}`));
  console.log('\nRefresh the Employees page in the CRM to see the data.');
}

fix();
