const { createClient } = require('@supabase/supabase-js');

const SERVICE_ROLE_KEY = process.argv[2];
if (!SERVICE_ROLE_KEY) { console.error('Usage: node fix_darshan_id.cjs SERVICE_ROLE_KEY'); process.exit(1); }

const supabase = createClient(
  'https://kswuwswgmgljpsvrnpbu.supabase.co',
  SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const EMAIL = 'choudharidarshan556@gmail.com';
const NEW_AUTH_ID = '7add52a3-b777-465b-b6fd-1962a4d99255';

async function fix() {
  // 1. Find old employee ID
  const { data: emp, error: empErr } = await supabase
    .from('employees')
    .select('id')
    .eq('email', EMAIL)
    .maybeSingle();

  if (empErr || !emp) {
    console.error('Employee not found:', empErr?.message);
    return;
  }

  const OLD_ID = emp.id;
  console.log('Old employee ID:', OLD_ID);
  console.log('New auth ID:    ', NEW_AUTH_ID);

  if (OLD_ID === NEW_AUTH_ID) {
    console.log('IDs already match — nothing to do!');
    return;
  }

  // 2. SAFE: Update all child tables FIRST so no data is orphaned or cascade-deleted
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

  console.log('\nStep 1: Migrating child table references...');
  for (const { table, col } of childTables) {
    const { error } = await supabase
      .from(table)
      .update({ [col]: NEW_AUTH_ID })
      .eq(col, OLD_ID);

    if (error) {
      console.log(`  ${table}: ${error.message}`);
    } else {
      console.log(`  ${table}: ✓ updated (${col})`);
    }
  }

  // 3. Verify no child rows still reference the old ID
  console.log('\nStep 2: Verifying no child rows remain on old ID...');
  let orphansExist = false;
  for (const { table, col } of childTables) {
    const { data: remaining } = await supabase
      .from(table)
      .select('id')
      .eq(col, OLD_ID)
      .limit(1);
    if (remaining && remaining.length > 0) {
      console.error(`  ✗ ${table} still has rows referencing old ID! Aborting to prevent data loss.`);
      orphansExist = true;
    }
  }
  if (orphansExist) {
    console.error('\nAborted: Some child rows could not be migrated. Fix manually before retrying.');
    return;
  }
  console.log('  All child references migrated safely.');

  // 4. Copy employee row with new ID, then remove old row
  // The old row delete is now safe — no child FKs point to it anymore
  console.log('\nStep 3: Migrating employee record...');
  const { data: fullEmp } = await supabase
    .from('employees')
    .select('*')
    .eq('id', OLD_ID)
    .single();

  if (!fullEmp) {
    console.error('Could not read full employee record');
    return;
  }

  const { id: _drop, ...rest } = fullEmp;
  const { error: insertErr } = await supabase
    .from('employees')
    .insert({ ...rest, id: NEW_AUTH_ID });

  if (insertErr) {
    console.error('Insert new record failed:', insertErr.message);
    console.log('\nAlternative: Run this SQL in Supabase SQL Editor:');
    console.log(`UPDATE employees SET id = '${NEW_AUTH_ID}' WHERE email = '${EMAIL}';`);
    return;
  }

  // Safe to delete — all child refs already moved to NEW_AUTH_ID
  const { error: delErr } = await supabase
    .from('employees')
    .delete()
    .eq('id', OLD_ID);

  if (delErr) {
    console.error('Delete old record failed:', delErr.message);
    console.log('NOTE: New record was created. You may have a duplicate — remove the old one manually.');
  } else {
    console.log('\n✓ Employee ID updated to match auth user');
    console.log('Darshan can now log in to the field app with:');
    console.log('  Email: ' + EMAIL);
    console.log('  Password: Creative@123');
  }
}

fix();
