"use server"

import { headers } from "next/headers"

import { staffForAction, staffLabel } from "@/lib/auth"
import { createClaim, type ClaimResult } from "@/lib/claim-service"

/** Brief: "Toll-free / customer-care-assisted claim — creates the same backend Claim ID". */
export async function submitAssistedClaim(wrn: string, raw: unknown): Promise<ClaimResult> {
  const a = await staffForAction(["customer_care"])
  if (!a.ok) return { ok: false, message: a.error }
  const h = await headers()
  return createClaim(wrn, raw, {
    channel: "customer_care",
    staffId: a.staff.id,
    uploaderId: a.staff.id,
    label: `${staffLabel(a.staff)} for customer (toll-free / customer care)`,
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: h.get("user-agent"),
  })
}
