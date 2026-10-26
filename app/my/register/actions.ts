"use server"

import { headers } from "next/headers"

import type { SubmitResult } from "@/components/registration/form-state"
import { getAuthUser, getCustomer } from "@/lib/auth"
import { toSlug } from "@/lib/domain/numbers"
import { createRegistration, prepareRegistration } from "@/lib/registration-service"

export async function submitRegistration(raw: unknown): Promise<SubmitResult> {
  const [user, customer] = await Promise.all([getAuthUser(), getCustomer()])
  if (!user || !customer) return { ok: false, message: "Your session has expired. Please log in again." }

  // The owner email is the login email; customers can't register under someone else's.
  const prepared = await prepareRegistration({ ...(raw as object), owner_email: customer.email }, user.id)
  if (!prepared.ok) return prepared

  const h = await headers()
  try {
    const result = await createRegistration({
      prepared,
      customerId: customer.id,
      channel: "self",
      actorLabel: `Customer (${customer.email})`,
      consentMethod: "email_otp_login",
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: h.get("user-agent"),
    })
    return { ok: true, kind: "registered", wrn: result.wrn, slug: toSlug(result.wrn), carePlus: result.carePlus, eWarranties: result.eWarranties }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Something went wrong. Please try again." }
  }
}
