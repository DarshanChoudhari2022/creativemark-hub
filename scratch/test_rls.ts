
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function checkPolicies() {
  // Querying pg_policies requires more permissions than anon usually has, 
  // but let's try a simple select to see if we can read.
  // Actually, let's try to insert a dummy partner.
  const { data, error } = await supabase
    .from('partners')
    .insert([{ name: 'Test Partner Seeding', type: 'Referral' }]);
  
  if (error) {
    console.log('Insert Error (Expected if RLS is on):', error.message);
  } else {
    console.log('Insert Success! RLS might be permissive or off.');
    console.log('Data:', data);
  }

  // Check if we can read everything
  const { count, error: countError } = await supabase
    .from('partners')
    .select('*', { count: 'exact', head: true });
  
  console.log('Partners count:', count);
}

checkPolicies();
