"use server"

import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto"
import { headers } from "next/headers"

import type { SubmitResult } from "@/components/registration/form-state"
import { getAuthUser, staffForAction, staffLabel } from "@/lib/auth"
import { toSlug } from "@/lib/domain/numbers"
import { notify } from "@/lib/notify"
import { createRegistration, customerForEmail, prepareRegistration } from "@/lib/registration-service"
import { supabaseAdmin } from "@/lib/supabase/admin"

// Brief §1: "the Customer Care / authorised HO team may complete the registration on behalf of the customer".
const ROLES = ["customer_care"] as const
const hash = (salt: string, code: string) => createHash("sha256").update(`${salt}:${code}`).digest("hex")

/** Step 1: validate the staff-filled form and email the customer a consent code. Nothing is saved yet. */
export async function startAssistedRegistration(raw: unknown): Promise<SubmitResult> {
  const a = await staffForAction(ROLES)
  if (!a.ok) return { ok: false, message: a.error }
  const user = await getAuthUser()
  const prepared = await prepareRegistration(raw, user!.id)
  if (!prepared.ok) return prepared

  const code = String(randomInt(100000, 1000000))
  const salt = randomBytes(8).toString("hex")
  const { data: otp, error } = await supabaseAdmin()
    .from("consent_otps")
    .insert({
      email: prepared.input.owner_email,
      code_hash: `${salt}:${hash(salt, code)}`,
      draft: prepared.input,
      staff_id: a.staff.id,
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    })
    .select("id")
    .single()
  if (error) return { ok: false, message: "Couldn't start the consent step. Please try again." }

  await notify("assisted_consent", prepared.input.owner_email, {
    name: prepared.input.owner_name,
    staff: `${a.staff.full_name} (Sylvan)`,
    site: `${prepared.input.site_address}, ${prepared.input.city}`,
    code,
  })
  return { ok: true, kind: "consent_required", otpId: otp.id, email: prepared.input.owner_email }
}

/** Step 2: the customer reads the code out; entering it records their consent and submits. */
export async function confirmAssistedConsent(otpId: string, code: string): Promise<SubmitResult> {
  const a = await staffForAction(ROLES)
  if (!a.ok) return { ok: false, message: a.error }
  const user = await getAuthUser()
  const db = supabaseAdmin()
  const { data: otp } = await db.from("consent_otps").select("*").eq("id", otpId).maybeSingle()
  if (!otp || otp.staff_id !== a.staff.id || otp.used_at) return { ok: false, message: "This consent request isn't valid any more. Submit the form again." }
  if (new Date(otp.expires_at).getTime() < Date.now()) return { ok: false, message: "The code has expired. Submit the form again to send a new one." }
  if (otp.attempts >= 5) return { ok: false, message: "Too many wrong attempts. Submit the form again to send a new code." }

  const [salt, expected] = String(otp.code_hash).split(":")
  const given = hash(salt, String(code ?? "").replace(/\D/g, ""))
  if (!timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    await db.from("consent_otps").update({ attempts: otp.attempts + 1 }).eq("id", otpId)
    return { ok: false, message: "That code is incorrect." }
  }
  await db.from("consent_otps").update({ used_at: new Date().toISOString() }).eq("id", otpId)

  const prepared = await prepareRegistration(otp.draft, user!.id)
  if (!prepared.ok) return prepared
  const input = prepared.input
  const h = await headers()
  try {
    const customerId = await customerForEmail(input.owner_email, input.owner_name, input.owner_mobile)
    const result = await createRegistration({
      prepared,
      customerId,
      channel: "customer_care",
      staffId: a.staff.id,
      actorLabel: `${staffLabel(a.staff)} for customer (consent by email code)`,
      consentMethod: "email_otp_assisted",
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: h.get("user-agent"),
    })
    return { ok: true, kind: "registered", wrn: result.wrn, slug: toSlug(result.wrn), carePlus: result.carePlus, eWarranties: result.eWarranties }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Something went wrong." }
  }
}
