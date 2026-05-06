/**
 * Confirm all unconfirmed Supabase Auth users.
 * 
 * Usage:
 *   node confirm_users.cjs YOUR_SERVICE_ROLE_KEY
 * 
 * Get your service role key from:
 *   Supabase Dashboard → Settings → API → service_role (secret)
 */
const { createClient } = require('@supabase/supabase-js');

const SERVICE_ROLE_KEY = process.argv[2];
if (!SERVICE_ROLE_KEY) {
  console.error('Usage: node confirm_users.cjs YOUR_SERVICE_ROLE_KEY');
  console.error('Get it from: Supabase Dashboard → Settings → API → service_role');
  process.exit(1);
}

const supabase = createClient(
  'https://kswuwswgmgljpsvrnpbu.supabase.co',
  SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

async function confirmAllUsers() {
  // List all auth users
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error('Error listing users:', error.message);
    return;
  }

  console.log(`Found ${users.length} auth users\n`);

  let confirmed = 0;
  let alreadyConfirmed = 0;

  for (const user of users) {
    const isConfirmed = !!user.email_confirmed_at;
    console.log(`${user.email} — ${isConfirmed ? 'CONFIRMED' : 'UNCONFIRMED'}`);

    if (!isConfirmed) {
      const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
        email_confirm: true
      });
      if (updateError) {
        console.error(`  ✗ Failed to confirm: ${updateError.message}`);
      } else {
        console.log(`  ✓ Now confirmed`);
        confirmed++;
      }
    } else {
      alreadyConfirmed++;
    }
  }

  console.log(`\nDone: ${confirmed} confirmed, ${alreadyConfirmed} already confirmed`);
}

confirmAllUsers();
