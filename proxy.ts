import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

// Refreshes the Supabase session cookie before portal and console pages render.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet, headers) => {
          for (const { name, value } of toSet) request.cookies.set(name, value)
          response = NextResponse.next({ request })
          for (const { name, value, options } of toSet) response.cookies.set(name, value, options)
          for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value)
        },
      },
    }
  )

  // getClaims refreshes an expired session and verifies the JWT locally, without an auth-server round trip.
  await supabase.auth.getClaims()
  return response
}

export const config = {
  matcher: ["/my/:path*", "/console/:path*", "/api/certificates/:path*", "/api/exports/:path*"],
}
