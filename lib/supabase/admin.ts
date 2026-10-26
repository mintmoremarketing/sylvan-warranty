import { createClient, type SupabaseClient } from "@supabase/supabase-js"

let admin: SupabaseClient | null = null

/**
 * Service-role client for writes and system jobs. Server only: callers must check the actor's
 * role first (see lib/auth.ts), because this bypasses RLS.
 */
export function supabaseAdmin() {
  admin ??= createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
  return admin
}
