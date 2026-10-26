"use server"

import { redirect } from "next/navigation"

import { safeRedirectPath } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { supabaseServer } from "@/lib/supabase/server"

export async function staffLogin(email: string, password: string, next?: string): Promise<{ ok: false; error: string }> {
  const supabase = await supabaseServer()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(email ?? "").trim().toLowerCase(),
    password: String(password ?? ""),
  })
  if (error || !data.user) return { ok: false, error: "Incorrect email or password." }

  const { data: staff } = await supabaseAdmin().from("staff").select("id").eq("id", data.user.id).eq("active", true).maybeSingle()
  if (!staff) {
    await supabase.auth.signOut()
    return { ok: false, error: "This account doesn't have console access." }
  }
  redirect(safeRedirectPath(next, "/console"))
}

export async function staffLogout() {
  const supabase = await supabaseServer()
  await supabase.auth.signOut()
  redirect("/console/login")
}
