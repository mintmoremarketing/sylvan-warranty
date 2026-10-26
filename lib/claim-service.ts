import { validateClaim, type ClaimItemRef } from "@/lib/domain/claim"
import { todayIST } from "@/lib/domain/dates"
import { toSlug } from "@/lib/domain/numbers"
import type { FieldErrors } from "@/lib/domain/registration"
import { addWorkingHours } from "@/lib/domain/sla"
import { notify } from "@/lib/notify"
import { getSettings } from "@/lib/settings"
import { cleanFiles, verifyUploads } from "@/lib/storage"
import { supabaseAdmin } from "@/lib/supabase/admin"

export type ClaimResult = { ok: true; claimNo: string; slug: string } | { ok: false; message: string; errors?: FieldErrors }

/** Who is raising the complaint: the customer from the portal, or Customer Care on a toll-free call. */
export type ClaimActor =
  | { channel: "self"; customerId: string; uploaderId: string; label: string; ip: string | null; userAgent: string | null }
  | { channel: "customer_care"; staffId: string; uploaderId: string; label: string; ip: string | null; userAgent: string | null }

/** Registers a complaint against an active SylvanCare+ warranty. Callers check who may act on it. */
export async function createClaim(wrn: string, raw: unknown, actor: ClaimActor): Promise<ClaimResult> {
  const db = supabaseAdmin()
  const { data: reg } = await db
    .from("registrations")
    .select("id, wrn, customer_id, owner_name, owner_email, status, claim_locked_at, registration_items(id, product_name, qty_used, utilised_qty, care_plus, care_start, care_expiry)")
    .eq("wrn", wrn)
    .maybeSingle()
  if (!reg || (actor.channel === "self" && reg.customer_id !== actor.customerId)) return { ok: false, message: "Warranty not found." }
  if (reg.status !== "active") return { ok: false, message: "Complaints can only be raised on an active SylvanCare+ warranty." }
  if (reg.claim_locked_at) return { ok: false, message: "A complaint has already been registered on this warranty." }

  const today = todayIST()
  type Item = { id: string; product_name: string; qty_used: number; utilised_qty: number; care_plus: boolean; care_start: string | null; care_expiry: string | null }
  const items: ClaimItemRef[] = (reg.registration_items as Item[])
    .filter((i) => i.care_plus && (!i.care_expiry || i.care_expiry >= today))
    .map((i) => ({ id: i.id, product_name: i.product_name, covered: i.qty_used - i.utilised_qty, care_start: i.care_start }))

  const r = (raw ?? {}) as Record<string, unknown>
  const input = {
    item_id: String(r.item_id ?? ""),
    complaint_type: String(r.complaint_type ?? ""),
    affected_qty: String(r.affected_qty ?? "").replace(/\D/g, "").slice(0, 6),
    noticed_on: String(r.noticed_on ?? "").slice(0, 10),
    description: String(r.description ?? "").trim().slice(0, 3000),
    photos: cleanFiles(r.photos, 12),
    videos: cleanFiles(r.videos, 2),
    declaration: r.declaration === true,
  }
  const errors = validateClaim(input, items, today)
  if (!(await verifyUploads(actor.uploaderId, [...input.photos, ...input.videos]))) errors.photos = "Please re-upload the photos"
  if (Object.keys(errors).length) return { ok: false, message: "Please fix the highlighted fields.", errors }

  const settings = await getSettings()
  const { data: claimNo, error } = await db.rpc("submit_claim", {
    p: {
      registration_id: reg.id,
      item_id: input.item_id,
      complaint_type: input.complaint_type,
      affected_qty: Number(input.affected_qty),
      noticed_on: input.noticed_on,
      description: input.description,
      channel: actor.channel,
      sla_due_at: addWorkingHours(new Date(), settings.sla.claim_screening_hours, settings.workingHours, settings.holidays).toISOString(),
      uploaded_by_customer: actor.channel === "self" ? actor.customerId : null,
      created_by_staff: actor.channel === "customer_care" ? actor.staffId : null,
      actor_label: actor.label,
      files: [...input.photos.map((f) => ({ ...f, kind: "claim_photo" })), ...input.videos.map((f) => ({ ...f, kind: "claim_video" }))],
      consent: {
        policy_version: settings.policyVersions.care_plus,
        statements: ["claim_declaration"],
        method: actor.channel === "self" ? "email_otp_login" : "customer_care_call",
        ip: actor.ip,
        user_agent: actor.userAgent,
      },
    },
  })
  if (error || typeof claimNo !== "string") {
    console.error("submit_claim", error)
    return { ok: false, message: "We couldn't register the complaint. Please try again." }
  }

  const { data: claim } = await db.from("claims").select("id").eq("claim_no", claimNo).single()
  await notify("claim_received", reg.owner_email, { name: reg.owner_name, claim_no: claimNo, slug: toSlug(claimNo) }, { registration_id: reg.id, claim_id: claim?.id })
  return { ok: true, claimNo, slug: toSlug(claimNo) }
}
