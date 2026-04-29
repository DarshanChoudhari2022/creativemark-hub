const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://kswuwswgmgljpsvrnpbu.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtzd3V3c3dnbWdsanBzdnJucGJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MzgyMjQsImV4cCI6MjA5MjMxNDIyNH0.1SxnTDCk3DAsFYit8yF3DzZmalz9jHaTIj141H-Xf8w', { auth: { persistSession: false } });

async function run() {
  // 1. Log in to bypass RLS
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'test@creativemark.com',
    password: 'Creative@123'
  });
  
  if (authError || !authData.user) {
    console.error("Login failed:", authError);
    return;
  }
  
  console.log("Logged in as:", authData.user.id);
  
  // 2. Set GPS location
  const lat = 18.9220; // Mumbai
  const lng = 72.8347;
  const now = new Date().toISOString();
  
  const { error: err1 } = await supabase.from('employees').update({
    current_lat: lat,
    current_lng: lng,
    last_location_update: now
  }).eq('id', authData.user.id);
  
  if (err1) {
    console.error("Failed to update employees table:", err1);
  } else {
    console.log("Success! Updated employees table with GPS.");
  }
}

run();
