import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kswuwswgmgljpsvrnpbu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtzd3V3c3dnbWdsanBzdnJucGJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MzgyMjQsImV4cCI6MjA5MjMxNDIyNH0.1SxnTDCk3DAsFYit8yF3DzZmalz9jHaTIj141H-Xf8w';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
