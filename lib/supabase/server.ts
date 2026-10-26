import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

/**
 * Supabase client acting as the signed-in user, so RLS decides what they can read.
 * Server components can't set cookies; proxy.ts refreshes the session before render.
 */
export async function supabaseServer() {
  const store = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (toSet) => {
          try {
            for (const { name, value, options } of toSet) store.set(name, value, options)
          } catch {
            // Called from a server component; proxy.ts handles the refresh.
          }
        },
      },
    }
  )
}
