// Supabase Edge Function: cleanup-shift-selfies
// Deletes shift selfie photos older than 2 days from storage.
// Schedule via Supabase Dashboard → Database → Extensions → pg_cron
// Or call manually: curl -X POST https://<project>.supabase.co/functions/v1/cleanup-shift-selfies

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  // Call the cleanup function which returns storage paths to delete
  const { data: paths, error } = await supabase.rpc('cleanup_old_shift_selfies')

  if (error) {
    console.error('cleanup_old_shift_selfies RPC error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  const validPaths = (paths || [])
    .map((r: { storage_path: string }) => r.storage_path)
    .filter((p: string) => p && p.length > 0)

  if (validPaths.length === 0) {
    return new Response(JSON.stringify({ deleted: 0, message: 'No old selfies to clean up' }))
  }

  // Delete from storage
  const { error: deleteError } = await supabase.storage
    .from('field-evidence')
    .remove(validPaths)

  if (deleteError) {
    console.error('Storage delete error:', deleteError.message)
    return new Response(JSON.stringify({ error: deleteError.message, attempted: validPaths.length }), { status: 500 })
  }

  console.log(`Cleaned up ${validPaths.length} old shift selfies`)
  return new Response(JSON.stringify({ deleted: validPaths.length }))
})
