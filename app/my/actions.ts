"use server"

import { redirect } from "next/navigation"

import { safeRedirectPath } from "@/lib/auth"
import { EMAIL_RE } from "@/lib/domain/registration"
import { supabaseServer } from "@/lib/supabase/server"

type Result = { ok: true } | { ok: false; error: string }

/** Emails a 6-digit login code. New emails get an account automatically. */
export async function sendLoginCode(rawEmail: string): Promise<Result> {
  const email = String(rawEmail ?? "").trim().toLowerCase()
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Enter a valid email address" }
  const supabase = await supabaseServer()
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
  if (error) {
    console.error("signInWithOtp", error.message)
    return {
      ok: false,
      error: error.status === 429 ? "Too many attempts. Please wait a minute and try again." : "We couldn't send the code. Please try again.",
    }
  }
  return { ok: true }
}

export async function verifyLoginCode(rawEmail: string, token: string, next?: string): Promise<Result> {
  const email = String(rawEmail ?? "").trim().toLowerCase()
  if (!/^\d{6}$/.test(token)) return { ok: false, error: "Enter the 6-digit code" }
  const supabase = await supabaseServer()
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" })
  if (error) return { ok: false, error: "That code is incorrect or has expired." }
  redirect(safeRedirectPath(next, "/my"))
}

export async function logout() {
  const supabase = await supabaseServer()
  await supabase.auth.signOut()
  redirect("/")
}
