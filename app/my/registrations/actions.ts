"use server"

import { revalidatePath } from "next/cache"

import { getAuthUser, getCustomer } from "@/lib/auth"
import { addWorkingHours } from "@/lib/domain/sla"
import { getSettings } from "@/lib/settings"
import { cleanFiles, verifyUploads } from "@/lib/storage"
import { supabaseAdmin } from "@/lib/supabase/admin"

type Result = { ok: true } | { ok: false; error: string }

/** Customer answers an "additional information required" request on a registration or a claim. */
export async function respondToInfoRequest(requestId: string, note: string, rawFiles: unknown): Promise<Result> {
  const [user, customer] = await Promise.all([getAuthUser(), getCustomer()])
  if (!user || !customer) return { ok: false, error: "Your session has expired. Please log in again." }

  const db = supabaseAdmin()
  const { data: req } = await db
    .from("info_requests")
    .select("id, registration_id, claim_id, responded_at, registrations(customer_id, wrn, status), claims(customer_id, status, claim_no)")
    .eq("id", requestId)
    .maybeSingle()
  const reg = req?.registrations as unknown as { customer_id: string; wrn: string; status: string } | null
  const claim = req?.claims as unknown as { customer_id: string; status: string; claim_no: string } | null
  const owner = claim?.customer_id ?? reg?.customer_id
  if (!req || owner !== customer.id) return { ok: false, error: "Request not found." }
  if (req.responded_at) return { ok: false, error: "You've already responded to this request." }

  const files = cleanFiles(rawFiles, 10)
  const text = String(note ?? "").trim().slice(0, 2000)
  if (!files.length && !text) return { ok: false, error: "Add a note or upload at least one file." }
  if (!(await verifyUploads(user.id, files))) return { ok: false, error: "Please re-upload your files." }

  if (files.length) {
    await db.from("documents").insert(
      files.map((f) => ({
        registration_id: req.registration_id,
        claim_id: req.claim_id,
        info_request_id: req.id,
        kind: "info_response",
        ...f,
        uploaded_by_customer: customer.id,
      }))
    )
  }
  await db.from("info_requests").update({ response_note: text || null, responded_at: new Date().toISOString() }).eq("id", req.id)

  // The SLA restarts once the information is in (brief: "provided all required information has been received").
  const settings = await getSettings()
  const due = addWorkingHours(new Date(), settings.sla.registration_hours, settings.workingHours, settings.holidays).toISOString()
  const event = {
    action: "info_submitted",
    actor_customer: customer.id,
    actor_label: `Customer (${customer.email})`,
    remarks: text || null,
    data: { files: files.length },
    visible_to_customer: true,
    customer_message: "Information submitted — back under verification",
  }

  const { error } = req.claim_id
    ? await db.rpc("transition_claim", { p_id: req.claim_id, p_from: ["info_required"], p_to: "under_review", p_set: { sla_due_at: due }, p_event: event })
    : await db.rpc("transition_registration", { p_id: req.registration_id, p_from: ["info_required"], p_to: "under_verification", p_set: { sla_due_at: due }, p_event: event })
  if (error) {
    console.error("respondToInfoRequest transition", error)
    return { ok: false, error: "Saved your files, but couldn't update the status. Please contact customer care." }
  }

  revalidatePath("/my", "layout")
  return { ok: true }
}
