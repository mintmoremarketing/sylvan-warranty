"use client"

import { useSyncExternalStore } from "react"

const noop = () => () => {}
const hasSession = () => /(?:^|;\s*)sb-[^=]+-auth-token(?:\.0)?=/.test(document.cookie)

/**
 * "Login" or "My Care+", decided in the browser from the Supabase session cookie, so the public
 * pages stay static instead of checking the session on the server for every visitor.
 */
export function PortalLabel() {
  const signedIn = useSyncExternalStore(noop, hasSession, () => false)
  return signedIn ? "My Care+" : "Login"
}
