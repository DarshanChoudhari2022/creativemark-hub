const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://kswuwswgmgljpsvrnpbu.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtzd3V3c3dnbWdsanBzdnJucGJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MzgyMjQsImV4cCI6MjA5MjMxNDIyNH0.1SxnTDCk3DAsFYit8yF3DzZmalz9jHaTIj141H-Xf8w', { auth: { persistSession: false } });

async function fix() {
  const { data: emps, error } = await supabase.from('employees').select('*');
  if (error) { console.error('Error fetching employees:', error); return; }
  console.log('Found employees:', emps.length);
  
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
    } else if (authData.user) {
      console.log('  -> Created auth user:', authData.user.id);
      
      const { error: updateError } = await supabase.from('employees')
        .update({ id: authData.user.id })
        .eq('email', emp.email);
        
      if (updateError) {
        console.error('  -> Failed to update employee ID:', updateError.message);
      } else {
        console.log('  -> Successfully updated employee ID');
      }
    }
  }
}
fix();
