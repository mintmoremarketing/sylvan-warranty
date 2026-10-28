"use server"

import { revalidatePath } from "next/cache"

import { audit } from "@/lib/audit"
import { hasRole, staffForAction, staffLabel, type Staff } from "@/lib/auth"
import { INFO_REQUEST_ITEMS, VERIFICATION_CHECKS, type VerificationResult } from "@/lib/domain/constants"
import { formatDate, formatDateTime } from "@/lib/domain/dates"
import { formatMobile } from "@/lib/domain/format"
import { toSlug } from "@/lib/domain/numbers"
import { notify } from "@/lib/notify"
import { cleanFiles, verifyUploads } from "@/lib/storage"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { moveRegistration, type ActionResult } from "@/lib/workflow"

// Who does what follows Sylvan's registration workflow:
// - the backend team / backend executive ("verifier") verifies, requests information, decides whether a
//   site inspection is required and assigns the inspector (§3–4);
// - the authorised backend approver / HO personnel ("approver") approves or rejects (§4, §6–9).

const APPROVAL_STAGE = ["pending_approval", "inspection_completed"]

async function reg(id: string) {
  const { data } = await supabaseAdmin()
    .from("registrations")
    .select("id, wrn, owner_name, owner_email, owner_mobile, site_address, city, state, pincode, status, verified_at")
    .eq("id", id)
    .maybeSingle()
  return data
}

/** §3: once the backend team opens a submission, it moves to Under Verification and the customer is told. */
export async function startVerification(id: string): Promise<ActionResult> {
  const a = await staffForAction(["verifier"])
  if (!a.ok) return a
  const r = await reg(id)
  if (!r || r.status !== "received") return { ok: true }
  const res = await moveRegistration(a.staff, id, ["received"], "under_verification", {
    action: "verification_started",
    visible_to_customer: true,
    customer_message: "Verification started",
  })
  if (res.ok) await notify("under_verification", r.owner_email, { name: r.owner_name, wrn: r.wrn, slug: toSlug(r.wrn) }, { registration_id: id })
  return res
}

/** §3: the backend team's checks, recorded against the employee who did them. */
export async function saveVerification(id: string, results: Record<string, VerificationResult>, remarks: string): Promise<ActionResult> {
  const a = await staffForAction(["verifier"])
  if (!a.ok) return a
  const r = await reg(id)
  if (!r) return { ok: false, error: "Not found." }
  if (r.status !== "under_verification") return { ok: false, error: "Verification can only be recorded while the registration is under verification." }

  const checks = Object.fromEntries(VERIFICATION_CHECKS.map((c) => [c.key, results[c.key]]))
  if (Object.values(checks).some((v) => v !== "ok" && v !== "issue")) return { ok: false, error: "Mark every check as OK or Issue." }
  const issues = VERIFICATION_CHECKS.filter((c) => checks[c.key] === "issue").map((c) => c.label)
  const note = remarks.trim().slice(0, 1000)

  const now = new Date().toISOString()
  const { error } = await supabaseAdmin()
    .from("registrations")
    .update({ verification: { checks, remarks: note || null }, verified_by: a.staff.id, verified_at: now })
    .eq("id", id)
  if (error) return { ok: false, error: "Couldn't save the verification." }
  await audit({
    registration_id: id,
    entity: "registration",
    action: "verification_recorded",
    actor_staff: a.staff.id,
    actor_label: staffLabel(a.staff),
    remarks: note || null,
    data: { issues },
  })
  revalidatePath("/console", "layout")
  return { ok: true }
}

/**
 * Each product on a registration is checked on its own. SylvanCare+ products are checked by the backend team
 * (or the approver) until the SylvanCare+ decision; standard products also by the sales coordinator, until the
 * e-warranty is issued. Only approved products go on the certificates.
 */
export async function reviewItem(itemId: string, decision: "approved" | "rejected" | "pending", remarks: string): Promise<ActionResult> {
  const a = await staffForAction(["verifier", "approver", "sales_coordinator"])
  if (!a.ok) return a
  if (!["approved", "rejected", "pending"].includes(decision)) return { ok: false, error: "Choose approve or reject." }
  const db = supabaseAdmin()
  const { data: item } = await db
    .from("registration_items")
    .select("id, registration_id, product_name, care_plus, standard, review_status, registrations(status), e_warranty_items(e_warranties(status))")
    .eq("id", itemId)
    .maybeSingle()
  if (!item) return { ok: false, error: "Product not found." }
  const regStatus = (item.registrations as unknown as { status: string }).status
  const ewStatus = (item.e_warranty_items as unknown as { e_warranties: { status: string } | null }[])[0]?.e_warranties?.status

  if (item.care_plus) {
    if (!hasRole(a.staff, ["verifier", "approver"])) return { ok: false, error: "SylvanCare+ products are checked by the backend team." }
    if (["active", "rejected", "approved"].includes(regStatus)) return { ok: false, error: "The SylvanCare+ decision has already been made." }
  } else {
    if (!item.standard) return { ok: false, error: "This product isn't covered by either warranty." }
    if (ewStatus !== "pending_review") return { ok: false, error: "The e-warranty has already been decided." }
  }

  const note = remarks.trim().slice(0, 500)
  const { error } = await db
    .from("registration_items")
    .update({ review_status: decision, review_note: note || null, reviewed_by: decision === "pending" ? null : a.staff.id, reviewed_at: decision === "pending" ? null : new Date().toISOString() })
    .eq("id", itemId)
  if (error) return { ok: false, error: "Couldn't save the check." }
  await audit({
    registration_id: item.registration_id,
    entity: "registration",
    action: decision === "pending" ? "product_check_reset" : `product_${decision}`,
    actor_staff: a.staff.id,
    actor_label: staffLabel(a.staff),
    remarks: note || null,
    data: { product: item.product_name, programme: item.care_plus ? "SylvanCare+" : "Standard" },
  })
  revalidatePath("/console", "layout")
  return { ok: true }
}

/**
 * §3: incomplete, unclear or correctable → Additional Information Required. The backend executive asks
 * during verification; the approver may ask at the approval stage instead of rejecting (§9).
 */
export async function requestInfo(id: string, items: string[], remarks: string): Promise<ActionResult> {
  const a = await staffForAction(["verifier", "approver"])
  if (!a.ok) return a
  const picked = items.filter((i) => (INFO_REQUEST_ITEMS as readonly string[]).includes(i))
  const note = remarks.trim().slice(0, 1000)
  if (!picked.length) return { ok: false, error: "Select what the customer needs to provide." }
  if (note.length < 5) return { ok: false, error: "Add remarks explaining what's needed." }
  const r = await reg(id)
  if (!r) return { ok: false, error: "Not found." }
  const from = [...(hasRole(a.staff, ["verifier"]) ? ["under_verification"] : []), ...(hasRole(a.staff, ["approver"]) ? APPROVAL_STAGE : [])]
  if (!from.includes(r.status)) return { ok: false, error: "You can't request information at this stage." }

  const db = supabaseAdmin()
  const { data: request } = await db.from("info_requests").insert({ registration_id: id, requested_items: picked, remarks: note, requested_by: a.staff.id }).select("id").single()
  const res = await moveRegistration(
    a.staff,
    id,
    from,
    "info_required",
    { action: "info_requested", remarks: note, data: { items: picked, request_id: request?.id }, visible_to_customer: true, customer_message: "Additional information requested" },
    { sla_due_at: "" }
  )
  if (!res.ok) {
    if (request) await db.from("info_requests").delete().eq("id", request.id)
    return res
  }
  await notify("info_required", r.owner_email, { name: r.owner_name, wrn: r.wrn, slug: toSlug(r.wrn), items: picked.join(", "), remarks: note }, { registration_id: id })
  return res
}

/** §4: "Is site inspection required? YES / NO" is mandatory, with a reason when it isn't. */
export async function decideInspection(id: string, needed: boolean, reasonCode: string, remarks: string): Promise<ActionResult> {
  const a = await staffForAction(["verifier"])
  if (!a.ok) return a
  const r = await reg(id)
  if (!r) return { ok: false, error: "Not found." }
  if (!r.verified_at) return { ok: false, error: "Record the verification checklist first." }
  const note = remarks.trim().slice(0, 1000)

  if (needed) {
    const res = await moveRegistration(
      a.staff,
      id,
      ["under_verification"],
      "inspection_required",
      { action: "inspection_required", remarks: note || null, visible_to_customer: true, customer_message: "Site inspection required" },
      { inspection_needed: true, inspection_reason: note || null }
    )
    if (res.ok) await notify("inspection_required", r.owner_email, { name: r.owner_name, wrn: r.wrn, slug: toSlug(r.wrn) }, { registration_id: id })
    return res
  }

  const { data: reason } = await supabaseAdmin().from("reason_codes").select("label, requires_remarks").eq("code", reasonCode).eq("context", "no_inspection").maybeSingle()
  if (!reason) return { ok: false, error: "Choose why an inspection isn't needed." }
  if (reason.requires_remarks && note.length < 5) return { ok: false, error: "Add remarks for “Other”." }
  // §8: without an inspection the 48 working hours run from submission to certificate, so the
  // registration keeps its existing due time.
  return moveRegistration(
    a.staff,
    id,
    ["under_verification"],
    "pending_approval",
    { action: "inspection_not_required", remarks: note || null, data: { reason_code: reasonCode, reason_label: reason.label } },
    { inspection_needed: false, inspection_reason: `${reason.label}${note ? ` — ${note}` : ""}` }
  )
}

/**
 * §4 (YES): the backend team assigns an authorised site inspector, gives them the WRN, customer and site
 * details and the inspection form link, informs the customer and coordinates the visit.
 */
export async function assignInspector(id: string, inspectorId: string, scheduledAt: string | null): Promise<ActionResult> {
  const a = await staffForAction(["verifier"])
  if (!a.ok) return a
  const db = supabaseAdmin()
  const r = await reg(id)
  if (!r) return { ok: false, error: "Not found." }
  if (!["inspection_required", "inspector_assigned"].includes(r.status)) return { ok: false, error: "This registration doesn't need an inspector now." }
  const { data: inspector } = await db.from("staff").select("id, full_name, email, roles, active").eq("id", inspectorId).maybeSingle()
  if (!inspector?.active || !(inspector.roles as string[]).includes("inspector")) return { ok: false, error: "Choose an active site inspector." }
  const when = scheduledAt ? new Date(scheduledAt) : null
  if (when && (isNaN(when.getTime()) || when.getTime() < Date.now() - 3_600_000)) return { ok: false, error: "Choose a date and time in the future." }

  // Reassigning cancels the previous open visit.
  await db.from("inspections").update({ status: "cancelled" }).eq("registration_id", id).eq("kind", "registration").in("status", ["assigned", "scheduled", "revisit_required"])
  const { data: inspection, error } = await db
    .from("inspections")
    .insert({ registration_id: id, kind: "registration", inspector_id: inspectorId, assigned_by: a.staff.id, scheduled_at: when?.toISOString() ?? null, status: when ? "scheduled" : "assigned" })
    .select("id")
    .single()
  if (error) return { ok: false, error: "Couldn't create the inspection." }

  const res =
    r.status === "inspector_assigned"
      ? (await audit({ registration_id: id, entity: "inspection", action: "inspector_reassigned", actor_staff: a.staff.id, actor_label: staffLabel(a.staff), data: { inspector: inspector.full_name, scheduled_at: when?.toISOString() ?? null }, visible_to_customer: !!when, customer_message: when ? "Site inspection rescheduled" : null }), { ok: true } as const)
      : await moveRegistration(
          a.staff,
          id,
          ["inspection_required"],
          "inspector_assigned",
          { action: "inspector_assigned", data: { inspector: inspector.full_name, inspection_id: inspection.id, scheduled_at: when?.toISOString() ?? null }, visible_to_customer: true, customer_message: when ? "Site inspection scheduled" : "Site inspector assigned" }
        )
  if (!res.ok) {
    await db.from("inspections").delete().eq("id", inspection.id)
    return res
  }

  await notifyInspector(inspector, a.staff, inspection.id, r, when)
  const path = `/my/registrations/${toSlug(r.wrn)}`
  if (when) await notify("inspection_scheduled", r.owner_email, { name: r.owner_name, ref: r.wrn, when: formatDateTime(when), inspector: inspector.full_name, path }, { registration_id: id })
  else await notify("inspector_assigned", r.owner_email, { name: r.owner_name, ref: r.wrn, inspector: inspector.full_name, path }, { registration_id: id })
  revalidatePath("/console", "layout")
  return { ok: true }
}

async function notifyInspector(
  inspector: { full_name: string; email: string },
  by: Staff,
  inspectionId: string,
  r: NonNullable<Awaited<ReturnType<typeof reg>>>,
  when: Date | null
) {
  await notify(
    "inspection_assignment",
    inspector.email,
    {
      inspector: inspector.full_name,
      ref: r.wrn,
      owner: r.owner_name,
      mobile: formatMobile(r.owner_mobile),
      site: `${r.site_address}, ${r.city}, ${r.state} — ${r.pincode}`,
      when: when ? formatDateTime(when) : null,
      by: by.full_name,
      path: `/console/inspections/${inspectionId}`,
    },
    { registration_id: r.id }
  )
}

/** Supporting photographs or documents attached to a decision (§6 "where relevant"). */
async function attachEvidence(staff: Staff, registrationId: string, rawFiles: unknown) {
  const files = cleanFiles(rawFiles, 5)
  if (!files.length) return { ok: true as const, count: 0 }
  if (!(await verifyUploads(staff.id, files))) return { ok: false as const, error: "Please re-upload the supporting documents." }
  await supabaseAdmin()
    .from("documents")
    .insert(files.map((f) => ({ registration_id: registrationId, kind: "decision_evidence", ...f, uploaded_by_staff: staff.id })))
  return { ok: true as const, count: files.length }
}

/**
 * §6–7: the authorised approver approves with mandatory remarks. Status moves to APPROVED; the system then
 * activates the warranty, generates the certificate and records commencement and expiry (WARRANTY ACTIVE).
 */
export async function approveRegistration(id: string, remarks: string, rawFiles: unknown): Promise<ActionResult> {
  const a = await staffForAction(["approver"])
  if (!a.ok) return a
  const note = remarks.trim().slice(0, 1000)
  if (note.length < 5) return { ok: false, error: "Remarks are mandatory for every decision." }
  const r = await reg(id)
  if (!r) return { ok: false, error: "Not found." }
  if (!APPROVAL_STAGE.includes(r.status)) return { ok: false, error: "This registration isn't ready for approval." }
  const { data: careItems } = await supabaseAdmin().from("registration_items").select("review_status").eq("registration_id", id).eq("care_plus", true)
  if ((careItems ?? []).some((i) => i.review_status === "pending")) return { ok: false, error: "Approve or reject each SylvanCare+ product first." }
  if (!(careItems ?? []).some((i) => i.review_status === "approved")) return { ok: false, error: "No SylvanCare+ product is approved. Reject the registration instead." }
  const evidence = await attachEvidence(a.staff, id, rawFiles)
  if (!evidence.ok) return evidence

  const res = await moveRegistration(
    a.staff,
    id,
    APPROVAL_STAGE,
    "approved",
    { action: "approved", remarks: note, data: { supporting_documents: evidence.count }, visible_to_customer: true, customer_message: "Registration approved" },
    { sla_due_at: "" }
  )
  if (!res.ok) return res
  const activated = await moveRegistration(null, id, ["approved"], "active", {
    action: "warranty_activated",
    visible_to_customer: true,
    customer_message: "Warranty active — certificate generated",
  })
  if (!activated.ok) return activated

  const { data: items } = await supabaseAdmin().from("registration_items").select("product_name, qty_used, care_expiry").eq("registration_id", id).eq("care_plus", true).eq("review_status", "approved")
  const coverage = (items ?? []).map((i) => `${i.product_name}: ${i.qty_used} sheets, valid till ${formatDate(i.care_expiry)}`).join("; ")
  await notify("certificate_issued", r.owner_email, { name: r.owner_name, wrn: r.wrn, slug: toSlug(r.wrn), coverage: `Coverage — ${coverage}.` }, { registration_id: id })
  return { ok: true }
}

/** §9: rejection needs a reason from the fixed list and detailed remarks; the customer is told why. */
export async function rejectRegistration(id: string, reasonCode: string, remarks: string, rawFiles: unknown): Promise<ActionResult> {
  const a = await staffForAction(["approver"])
  if (!a.ok) return a
  const note = remarks.trim().slice(0, 1000)
  const { data: reason } = await supabaseAdmin().from("reason_codes").select("label").eq("code", reasonCode).eq("context", "registration_reject").maybeSingle()
  if (!reason) return { ok: false, error: "Choose a rejection reason." }
  if (note.length < 5) return { ok: false, error: "Detailed remarks are mandatory for a rejection." }
  const r = await reg(id)
  if (!r) return { ok: false, error: "Not found." }
  if (!APPROVAL_STAGE.includes(r.status)) return { ok: false, error: "This registration isn't ready for a decision." }
  const evidence = await attachEvidence(a.staff, id, rawFiles)
  if (!evidence.ok) return evidence

  const res = await moveRegistration(
    a.staff,
    id,
    APPROVAL_STAGE,
    "rejected",
    {
      action: "rejected",
      remarks: note,
      data: { reason_code: reasonCode, reason_label: reason.label, supporting_documents: evidence.count },
      visible_to_customer: true,
      customer_message: `Registration could not be approved: ${reason.label}`,
    },
    { sla_due_at: "" }
  )
  if (res.ok)
    await notify("registration_rejected", r.owner_email, { name: r.owner_name, wrn: r.wrn, slug: toSlug(r.wrn), reason: reason.label, remarks: note }, { registration_id: id })
  return res
}

export async function clearFlag(flagId: string, reason: string): Promise<ActionResult> {
  const a = await staffForAction(["verifier", "approver"])
  if (!a.ok) return a
  const note = reason.trim().slice(0, 500)
  if (note.length < 5) return { ok: false, error: "Explain why this flag is cleared — it's logged as an override." }
  const db = supabaseAdmin()
  const { data: flag } = await db.from("fraud_flags").select("id, registration_id, claim_id, code, detail, status").eq("id", flagId).maybeSingle()
  if (!flag || flag.status !== "open") return { ok: false, error: "Flag not found." }
  await db.from("fraud_flags").update({ status: "cleared", cleared_by: a.staff.id, cleared_reason: note, cleared_at: new Date().toISOString() }).eq("id", flagId)
  await audit({ registration_id: flag.registration_id, claim_id: flag.claim_id, entity: "registration", action: "flag_overridden", actor_staff: a.staff.id, actor_label: staffLabel(a.staff), remarks: note, data: { code: flag.code, detail: flag.detail } })
  revalidatePath("/console", "layout")
  return { ok: true }
}
