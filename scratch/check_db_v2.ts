
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function check() {
  const tables = [
    'clients', 'leads', 'employees', 'quotations', 'partners', 
    'calendar_events', 'lead_tasks', 'payment_history', 'expenses',
    'work_logs', 'client_meetings', 'client_services', 'client_shoots',
    'client_posts', 'recovery_reminders', 'recovery_notes', 'smart_leads'
  ];

  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log(`${table}: Error - ${error.message}`);
    } else {
      console.log(`${table}: ${count} records`);
      if (count && count > 0) {
          const { data } = await supabase.from(table).select('*').limit(1);
          console.log(`  Sample:`, data?.[0]);
      }
    }
  }
}

check();
