const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://kswuwswgmgljpsvrnpbu.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtzd3V3c3dnbWdsanBzdnJucGJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MzgyMjQsImV4cCI6MjA5MjMxNDIyNH0.1SxnTDCk3DAsFYit8yF3DzZmalz9jHaTIj141H-Xf8w', { auth: { persistSession: false } });

async function setTestLocation() {
  console.log("Setting test location for Test Employee...");
  const email = "test@creativemark.com";
  
  // Get employee ID
  const { data: emps, error: err1 } = await supabase.from('employees').select('id').eq('email', email);
  if (!emps || emps.length === 0) {
    console.log("Could not find Test Employee");
    return;
  }
  
  const empId = emps[0].id;
  
  // Set location to Mumbai (Gateway of India)
  const lat = 18.9220;
  const lng = 72.8347;
  const now = new Date().toISOString();
  
  const { error: err2 } = await supabase.from('employees').update({
    current_lat: lat,
    current_lng: lng,
    last_location_update: now
  }).eq('id', empId);
  
  if (err2) {
    console.log("Failed to update location:", err2);
  } else {
    console.log("Successfully set test location to Mumbai!");
  }
}
setTestLocation();
