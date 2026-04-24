import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const tables = [
  'clients',
  'leads',
  'employees',
  'quotations',
  'partners',
  'calendar_events',
  'lead_tasks',
  'payment_history',
  'expenses'
];

async function checkDB() {
  console.log('Checking database tables...');
  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error(`Error checking table ${table}:`, error.message);
    } else {
      console.log(`Table ${table}: ${count} records`);
    }
  }

  // Check if any clients are actually there but not showing up
  const { data: clientData, error: clientError } = await supabase.from('clients').select('*').limit(5);
  if (clientError) {
    console.error('Error fetching clients:', clientError.message);
  } else {
    console.log('Sample clients:', JSON.stringify(clientData, null, 2));
  }
  
  // Check payments to see where "40k" might come from
  const { data: paymentData, error: paymentError } = await supabase.from('payment_history').select('*');
  if (paymentError) {
    console.error('Error fetching payments:', paymentError.message);
  } else {
    const total = paymentData?.reduce((s, p) => s + (p.amount || 0), 0);
    console.log(`Total Received Payments: ${total}`);
  }

  // Check quotations for pending amount
  const { data: quoteData, error: quoteError } = await supabase.from('quotations').select('*');
  if (quoteError) {
    console.error('Error fetching quotations:', quoteError.message);
  } else {
    const totalBilled = quoteData?.filter(q => q.type === 'Bill').reduce((s, q) => s + (q.grand_total || 0), 0);
    console.log(`Total Billed: ${totalBilled}`);
  }
}

checkDB();
