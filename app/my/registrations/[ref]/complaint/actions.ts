"use server"

import { headers } from "next/headers"

import { getAuthUser, getCustomer } from "@/lib/auth"
import { createClaim, type ClaimResult } from "@/lib/claim-service"

export type { ClaimResult }

export async function submitClaim(wrn: string, raw: unknown): Promise<ClaimResult> {
  const [user, customer] = await Promise.all([getAuthUser(), getCustomer()])
  if (!user || !customer) return { ok: false, message: "Your session has expired. Please log in again." }
  const h = await headers()
  return createClaim(wrn, raw, {
    channel: "self",
    customerId: customer.id,
    uploaderId: user.id,
    label: `Customer (${customer.email})`,
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: h.get("user-agent"),
  })
}
