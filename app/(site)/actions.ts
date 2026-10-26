"use server"

import { EMAIL_RE, MOBILE_RE, NAME_RE } from "@/lib/domain/registration"
import { supabaseAdmin } from "@/lib/supabase/admin"

export type CallbackInput = { name: string; mobile: string; email: string; topic: string; message: string }

export async function requestCallback(input: CallbackInput): Promise<{ ok: true } | { ok: false; errors: Record<string, string> }> {
  const name = String(input.name ?? "").trim().slice(0, 80)
  const mobile = String(input.mobile ?? "").replace(/\D/g, "").slice(0, 10)
  const email = String(input.email ?? "").trim().toLowerCase().slice(0, 120)
  const topic = String(input.topic ?? "").slice(0, 60)
  const message = String(input.message ?? "").trim().slice(0, 1000)

  const errors: Record<string, string> = {}
  if (!NAME_RE.test(name)) errors.name = "Enter your name"
  if (!MOBILE_RE.test(mobile)) errors.mobile = "Enter a valid 10-digit mobile number"
  if (email && !EMAIL_RE.test(email)) errors.email = "Enter a valid email address"
  if (!topic) errors.topic = "Choose a topic"
  if (Object.keys(errors).length) return { ok: false, errors }

  const { error } = await supabaseAdmin()
    .from("callback_requests")
    .insert({ name, mobile, email: email || null, topic, message: message || null })
  if (error) {
    console.error("requestCallback", error)
    return { ok: false, errors: { form: "Something went wrong. Please try again." } }
  }
  return { ok: true }
}
