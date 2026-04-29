const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://kswuwswgmgljpsvrnpbu.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtzd3V3c3dnbWdsanBzdnJucGJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MzgyMjQsImV4cCI6MjA5MjMxNDIyNH0.1SxnTDCk3DAsFYit8yF3DzZmalz9jHaTIj141H-Xf8w', { auth: { persistSession: false } });

async function createTestUser() {
  console.log("Creating test user...");
  const email = "test@creativemark.com";
  const password = "Creative@123";
  
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: email,
    password: password,
    options: { data: { full_name: "Test Employee" } }
  });
  
  if (authError) {
    console.error('SignUp error:', authError.message);
  } else if (authData.user) {
    console.log('Created auth user:', authData.user.id);
    
    // Check if employee exists
    const { data: emps } = await supabase.from('employees').select('id').eq('email', email);
    if (emps && emps.length > 0) {
      console.log('Employee record already exists. Updating ID...');
      await supabase.from('employees').update({ id: authData.user.id }).eq('email', email);
    } else {
      console.log('Inserting new employee record...');
      await supabase.from('employees').insert({
        id: authData.user.id,
        email: email,
        name: "Test Employee",
        role: "Employee",
        status: "Active"
      });
    }
    console.log("SUCCESS! You can now log in with:");
    console.log("Email:", email);
    console.log("Password:", password);
  }
}
createTestUser();
