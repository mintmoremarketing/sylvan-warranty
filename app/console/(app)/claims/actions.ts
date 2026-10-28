"use server"

import { revalidatePath } from "next/cache"

import { audit } from "@/lib/audit"
import { getAuthUser, staffForAction, staffLabel } from "@/lib/auth"
import { computeSheet, SCREENING_CHECKS, SETTLEMENT_MODES } from "@/lib/domain/compensation"
import { INFO_REQUEST_ITEMS, LABS } from "@/lib/domain/constants"
import { formatDateTime } from "@/lib/domain/dates"
import { formatMobile } from "@/lib/domain/format"
import { toSlug } from "@/lib/domain/numbers"
import { notify } from "@/lib/notify"
import { cleanFiles, verifyUploads } from "@/lib/storage"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { moveClaim, type ActionResult } from "@/lib/workflow"

async function claim(id: string) {
  const { data } = await supabaseAdmin()
    .from("claims")
    .select("id, claim_no, status, decision, approved_qty, affected_qty, registration_id, registrations(owner_name, owner_email, owner_mobile, site_address, city, state, pincode)")
    .eq("id", id)
    .maybeSingle()
  if (!data) return null
  const reg = data.registrations as unknown as { owner_name: string; owner_email: string; owner_mobile: string; site_address: string; city: string; state: string; pincode: string }
  return {
    ...data,
    name: reg.owner_name,
    email: reg.owner_email,
    mobile: reg.owner_mobile,
    site: `${reg.site_address}, ${reg.city}, ${reg.state} — ${reg.pincode}`,
    slug: toSlug(data.claim_no),
  }
}

const done = () => {
  revalidatePath("/console", "layout")
  return { ok: true } as const
}

// Pre-screening, information requests and inspector assignment sit with the backend team, as for
// registrations; HO technical takes the technical decision; the authorised approver and finance approve
// compensation; finance runs the settlement.

export async function startScreening(id: string): Promise<ActionResult> {
  const a = await staffForAction(["verifier"])
  if (!a.ok) return a
  const c = await claim(id)
  if (!c || c.status !== "received") return { ok: true }
  return moveClaim(a.staff, id, ["received"], "under_review", { action: "screening_started", visible_to_customer: true, customer_message: "Under review" })
}

export async function saveScreening(
  id: string,
  checks: Record<string, boolean>,
  outcome: "inspection" | "reject",
  findingCode: string,
  remarks: string
): Promise<ActionResult> {
  const a = await staffForAction(["verifier"])
  if (!a.ok) return a
  const c = await claim(id)
  if (!c) return { ok: false, error: "Not found." }
  const note = remarks.trim().slice(0, 2000)
  const screening = Object.fromEntries(SCREENING_CHECKS.map((k) => [k.key, !!checks[k.key]]))

  if (outcome === "inspection") {
    if (SCREENING_CHECKS.some((k) => !screening[k.key])) return { ok: false, error: "Every check must pass to proceed — otherwise request info or reject." }
    // Policy 5.5: no compensation without a site inspection, so passing screening always leads to one.
    return moveClaim(a.staff, id, ["under_review"], "inspection_required", { action: "screening_passed", remarks: note || null, data: { screening }, visible_to_customer: true, customer_message: "Inspection required" }, { screening })
  }

  const { data: reason } = await supabaseAdmin().from("reason_codes").select("label").eq("code", findingCode).eq("context", "claim_finding").maybeSingle()
  if (!reason) return { ok: false, error: "Choose the reason for rejection." }
  if (!note) return { ok: false, error: "Remarks are mandatory for a rejection." }
  const res = await moveClaim(
    a.staff,
    id,
    ["under_review"],
    "rejected",
    { action: "rejected_at_screening", remarks: note, data: { screening, finding: reason.label }, visible_to_customer: true, customer_message: "Claim rejected" },
    { screening, decision: "rejected", finding_code: findingCode, decision_remarks: note, decided_by: a.staff.id, sla_due_at: "" }
  )
  if (res.ok) await notify("claim_decided", c.email, { name: c.name, claim_no: c.claim_no, slug: c.slug, decision: "rejected", decision_label: "Rejected", remarks: `${reason.label}. ${note}` }, { registration_id: c.registration_id, claim_id: id })
  return res
}

export async function requestClaimInfo(id: string, items: string[], remarks: string): Promise<ActionResult> {
  const a = await staffForAction(["verifier", "technical"])
  if (!a.ok) return a
  const picked = items.filter((i) => (INFO_REQUEST_ITEMS as readonly string[]).includes(i))
  const note = remarks.trim().slice(0, 1000)
  if (!picked.length || !note) return { ok: false, error: "Select what's needed and add remarks." }
  const c = await claim(id)
  if (!c) return { ok: false, error: "Not found." }
  const db = supabaseAdmin()
  const { data: req } = await db.from("info_requests").insert({ registration_id: c.registration_id, claim_id: id, requested_items: picked, remarks: note, requested_by: a.staff.id }).select("id").single()
  const res = await moveClaim(a.staff, id, ["under_review", "technical_review"], "info_required", { action: "info_requested", remarks: note, data: { items: picked }, visible_to_customer: true, customer_message: "Additional information requested" }, { sla_due_at: "" })
  if (!res.ok) {
    if (req) await db.from("info_requests").delete().eq("id", req.id)
    return res
  }
  await notify("claim_info_required", c.email, { name: c.name, claim_no: c.claim_no, slug: c.slug, items: picked.join(", "), remarks: note }, { registration_id: c.registration_id, claim_id: id })
  return res
}

export async function assignClaimInspector(id: string, inspectorId: string, scheduledAt: string | null): Promise<ActionResult> {
  const a = await staffForAction(["verifier"])
  if (!a.ok) return a
  const c = await claim(id)
  if (!c) return { ok: false, error: "Not found." }
  const db = supabaseAdmin()
  const { data: inspector } = await db.from("staff").select("id, full_name, email, roles, active").eq("id", inspectorId).maybeSingle()
  if (!inspector?.active || !(inspector.roles as string[]).includes("inspector")) return { ok: false, error: "Choose an active site inspector." }
  const when = scheduledAt ? new Date(scheduledAt) : null
  if (when && (isNaN(when.getTime()) || when.getTime() < Date.now() - 3_600_000)) return { ok: false, error: "Choose a date and time in the future." }

  await db.from("inspections").update({ status: "cancelled" }).eq("claim_id", id).in("status", ["assigned", "scheduled", "revisit_required"])
  const { data: insp, error } = await db
    .from("inspections")
    .insert({ registration_id: c.registration_id, claim_id: id, kind: "claim", inspector_id: inspectorId, assigned_by: a.staff.id, scheduled_at: when?.toISOString() ?? null, status: when ? "scheduled" : "assigned" })
    .select("id")
    .single()
  if (error) return { ok: false, error: "Couldn't create the inspection." }

  if (c.status === "inspection_required" && when) {
    const res = await moveClaim(a.staff, id, ["inspection_required"], "inspection_scheduled", { action: "inspector_assigned", data: { inspector: inspector.full_name, inspection_id: insp.id, at: when.toISOString() }, visible_to_customer: true, customer_message: "Inspection scheduled" })
    if (!res.ok) return res
  } else {
    await audit({ registration_id: c.registration_id, claim_id: id, entity: "inspection", action: "inspector_assigned", actor_staff: a.staff.id, actor_label: staffLabel(a.staff), data: { inspector: inspector.full_name, inspection_id: insp.id } })
  }
  // "Inspector receives claim summary before visit."
  await notify(
    "inspection_assignment",
    inspector.email,
    { inspector: inspector.full_name, ref: c.claim_no, owner: c.name, mobile: formatMobile(c.mobile), site: c.site, when: when ? formatDateTime(when) : null, by: a.staff.full_name, path: `/console/inspections/${insp.id}` },
    { registration_id: c.registration_id, claim_id: id }
  )
  const links = { registration_id: c.registration_id, claim_id: id }
  if (when) await notify("inspection_scheduled", c.email, { name: c.name, ref: c.claim_no, when: formatDateTime(when), inspector: inspector.full_name, path: `/my/claims/${c.slug}` }, links)
  else await notify("inspector_assigned", c.email, { name: c.name, ref: c.claim_no, inspector: inspector.full_name, path: `/my/claims/${c.slug}` }, links)
  return done()
}

export async function startTechnicalReview(id: string): Promise<ActionResult> {
  const a = await staffForAction(["technical"])
  if (!a.ok) return a
  return moveClaim(a.staff, id, ["inspection_completed", "further_testing"], "technical_review", { action: "technical_review_started", visible_to_customer: true, customer_message: "Under technical review" })
}

export async function recordSample(id: string, input: { seal_no: string; description: string; collected_at: string; customer_ack: boolean }): Promise<ActionResult> {
  const a = await staffForAction(["technical", "inspector"])
  if (!a.ok) return a
  const c = await claim(id)
  if (!c) return { ok: false, error: "Not found." }
  const seal = input.seal_no.trim().slice(0, 40)
  const desc = input.description.trim().slice(0, 500)
  const at = new Date(input.collected_at)
  if (!seal || !desc || isNaN(at.getTime())) return { ok: false, error: "Enter the seal number, description and collection time." }
  const db = supabaseAdmin()
  const { data: sample, error } = await db.from("samples").insert({ claim_id: id, seal_no: seal, description: desc, collected_by: a.staff.id, collected_at: at.toISOString(), customer_ack: !!input.customer_ack }).select("id").single()
  if (error) return { ok: false, error: error.code === "23505" ? "That seal number is already used." : "Couldn't save the sample." }
  await db.from("custody_events").insert({ sample_id: sample.id, event: "Collected and sealed at site", location: "Customer site", handled_by: a.staff.full_name, at: at.toISOString(), recorded_by: a.staff.id })

  if (["technical_review", "inspection_completed"].includes(c.status)) {
    const res = await moveClaim(a.staff, id, ["technical_review", "inspection_completed"], "further_testing", { action: "sample_collected", data: { seal_no: seal }, visible_to_customer: true, customer_message: "Further testing required" })
    if (!res.ok) return res
    await notify("claim_further_testing", c.email, { name: c.name, claim_no: c.claim_no, slug: c.slug }, { registration_id: c.registration_id, claim_id: id })
  } else {
    await audit({ registration_id: c.registration_id, claim_id: id, entity: "claim", action: "sample_collected", actor_staff: a.staff.id, actor_label: staffLabel(a.staff), data: { seal_no: seal } })
  }
  return done()
}

export async function addCustodyEvent(sampleId: string, input: { event: string; location: string; handled_by: string; at: string }): Promise<ActionResult> {
  const a = await staffForAction(["technical", "inspector"])
  if (!a.ok) return a
  const at = new Date(input.at)
  if (!input.event.trim() || !input.location.trim() || !input.handled_by.trim() || isNaN(at.getTime())) return { ok: false, error: "Fill in every field." }
  const db = supabaseAdmin()
  const { data: s } = await db.from("samples").select("id, claim_id, seal_no, claims(registration_id)").eq("id", sampleId).maybeSingle()
  if (!s) return { ok: false, error: "Sample not found." }
  await db.from("custody_events").insert({ sample_id: sampleId, event: input.event.trim().slice(0, 200), location: input.location.trim().slice(0, 200), handled_by: input.handled_by.trim().slice(0, 100), at: at.toISOString(), recorded_by: a.staff.id })
  await audit({ registration_id: (s.claims as unknown as { registration_id: string }).registration_id, claim_id: s.claim_id, entity: "claim", action: "custody_event", actor_staff: a.staff.id, actor_label: staffLabel(a.staff), data: { seal_no: s.seal_no, event: input.event } })
  return done()
}

export async function addLabReport(
  id: string,
  input: { sample_id: string; lab_name: string; report_no: string; report_date: string; result: string; summary: string; files: unknown }
): Promise<ActionResult> {
  const a = await staffForAction(["technical"])
  if (!a.ok) return a
  const user = await getAuthUser()
  const c = await claim(id)
  if (!c) return { ok: false, error: "Not found." }
  if (!(LABS as readonly string[]).includes(input.lab_name)) return { ok: false, error: "Choose the laboratory." }
  if (!["defect_confirmed", "no_defect", "inconclusive"].includes(input.result)) return { ok: false, error: "Choose the result." }
  if (!input.report_date || !input.summary.trim()) return { ok: false, error: "Add the report date and a summary." }
  const files = cleanFiles(input.files, 3)
  if (!(await verifyUploads(user!.id, files))) return { ok: false, error: "Please re-upload the report." }

  const db = supabaseAdmin()
  let documentId: string | null = null
  if (files[0]) {
    const { data: d } = await db.from("documents").insert({ registration_id: c.registration_id, claim_id: id, kind: "lab_report", ...files[0], uploaded_by_staff: a.staff.id }).select("id").single()
    documentId = d?.id ?? null
  }
  await db.from("lab_reports").insert({
    claim_id: id,
    sample_id: input.sample_id || null,
    lab_name: input.lab_name,
    report_no: input.report_no.trim().slice(0, 60) || null,
    report_date: input.report_date,
    result: input.result,
    summary: input.summary.trim().slice(0, 2000),
    document_id: documentId,
    recorded_by: a.staff.id,
  })
  if (c.status === "further_testing")
    return moveClaim(a.staff, id, ["further_testing"], "technical_review", { action: "lab_report_received", data: { lab: input.lab_name, result: input.result }, visible_to_customer: true, customer_message: "Test results received — under technical review" })
  await audit({ registration_id: c.registration_id, claim_id: id, entity: "claim", action: "lab_report_received", actor_staff: a.staff.id, actor_label: staffLabel(a.staff), data: { lab: input.lab_name, result: input.result } })
  return done()
}

export async function decideClaim(id: string, decision: "approved" | "partially_approved" | "rejected", findingCode: string, approvedQty: string, remarks: string): Promise<ActionResult> {
  // Brief: the inspector cannot approve compensation; the decision rests with HO technical.
  const a = await staffForAction(["technical"])
  if (!a.ok) return a
  const c = await claim(id)
  if (!c) return { ok: false, error: "Not found." }
  const note = remarks.trim().slice(0, 2000)
  if (!note) return { ok: false, error: "HO technical remarks are mandatory." }
  const { data: reason } = await supabaseAdmin().from("reason_codes").select("label").eq("code", findingCode).eq("context", "claim_finding").maybeSingle()
  if (!reason) return { ok: false, error: "Choose the technical finding." }
  let qty: number | null = null
  if (decision !== "rejected") {
    qty = Number(approvedQty)
    if (!Number.isInteger(qty) || qty < 1 || qty > c.affected_qty) return { ok: false, error: `Approved quantity must be 1–${c.affected_qty}.` }
  }
  const label = decision === "approved" ? "Approved" : decision === "partially_approved" ? "Partially approved" : "Rejected"
  const res = await moveClaim(
    a.staff,
    id,
    ["technical_review"],
    decision,
    { action: `claim_${decision}`, remarks: note, data: { finding: reason.label, approved_qty: qty }, visible_to_customer: true, customer_message: `Claim ${label.toLowerCase()}` },
    { decision, finding_code: findingCode, decision_remarks: note, decided_by: a.staff.id, approved_qty: qty, sla_due_at: "" }
  )
  if (res.ok) await notify("claim_decided", c.email, { name: c.name, claim_no: c.claim_no, slug: c.slug, decision, decision_label: label, remarks: `${reason.label}. ${note}` }, { registration_id: c.registration_id, claim_id: id })
  return res
}

export async function saveCompensation(id: string, lines: { key: string; claimed: string; estimate: string }[]): Promise<ActionResult> {
  const a = await staffForAction(["technical"])
  if (!a.ok) return a
  const c = await claim(id)
  if (!c || !["approved", "partially_approved"].includes(c.status)) return { ok: false, error: "The compensation sheet is prepared after the claim is approved." }
  const sheet = computeSheet(lines)
  const total = Math.round(sheet.reduce((s, l) => s + l.payable, 0) * 100) / 100
  if (total <= 0) return { ok: false, error: "Enter at least one amount." }
  const db = supabaseAdmin()
  const { data: existing } = await db.from("compensation_sheets").select("id, approved_at").eq("claim_id", id).maybeSingle()
  if (existing?.approved_at) return { ok: false, error: "This sheet is already approved and can't be edited." }
  const row = { claim_id: id, lines: sheet, total_payable: total, prepared_by: a.staff.id, prepared_at: new Date().toISOString() }
  if (existing) await db.from("compensation_sheets").update(row).eq("id", existing.id)
  else await db.from("compensation_sheets").insert(row)
  await audit({ registration_id: c.registration_id, claim_id: id, entity: "claim", action: "compensation_prepared", actor_staff: a.staff.id, actor_label: staffLabel(a.staff), data: { total } })
  return done()
}

export async function approveCompensation(id: string): Promise<ActionResult> {
  const a = await staffForAction(["approver"])
  if (!a.ok) return a
  const c = await claim(id)
  if (!c) return { ok: false, error: "Not found." }
  const db = supabaseAdmin()
  const { data: sheet } = await db.from("compensation_sheets").select("id, total_payable, prepared_by, approved_at").eq("claim_id", id).maybeSingle()
  if (!sheet) return { ok: false, error: "No compensation sheet yet." }
  if (sheet.approved_at) return { ok: false, error: "Already approved." }
  if (sheet.prepared_by === a.staff.id) return { ok: false, error: "The person who prepared the sheet can't also approve it." }
  await db.from("compensation_sheets").update({ approved_by: a.staff.id, approved_at: new Date().toISOString() }).eq("id", sheet.id)
  await audit({ registration_id: c.registration_id, claim_id: id, entity: "claim", action: "compensation_approved", actor_staff: a.staff.id, actor_label: staffLabel(a.staff), data: { total: sheet.total_payable } })
  return done()
}

export async function financeApprove(id: string, mode: string): Promise<ActionResult> {
  const a = await staffForAction(["finance"])
  if (!a.ok) return a
  const c = await claim(id)
  if (!c) return { ok: false, error: "Not found." }
  if (!SETTLEMENT_MODES.some((m) => m.value === mode)) return { ok: false, error: "Choose how the claim will be settled." }
  const db = supabaseAdmin()
  const { data: sheet } = await db.from("compensation_sheets").select("id, total_payable, approved_at, finance_approved_at").eq("claim_id", id).maybeSingle()
  if (!sheet?.approved_at) return { ok: false, error: "The compensation sheet needs approver sign-off first." }
  if (sheet.finance_approved_at) return { ok: false, error: "Already approved by finance." }
  await db.from("compensation_sheets").update({ finance_approved_by: a.staff.id, finance_approved_at: new Date().toISOString() }).eq("id", sheet.id)
  await db.from("settlements").insert({ claim_id: id, mode, updated_by: a.staff.id })
  const res = await moveClaim(a.staff, id, ["approved", "partially_approved"], "settlement_in_progress", { action: "finance_approved", data: { total: sheet.total_payable, mode }, visible_to_customer: true, customer_message: "Compensation approved — settlement in progress" })
  if (res.ok) await notify("compensation_approved", c.email, { name: c.name, claim_no: c.claim_no, slug: c.slug }, { registration_id: c.registration_id, claim_id: id })
  return res
}

export async function updateSettlement(
  id: string,
  input: { bank_verified: boolean; bank_reference: string; replacement_details: string; payment_reference: string; customer_accepted: boolean; restoration_confirmed: boolean; notes: string; files: unknown }
): Promise<ActionResult> {
  const a = await staffForAction(["finance"])
  if (!a.ok) return a
  const user = await getAuthUser()
  const c = await claim(id)
  if (!c || c.status !== "settlement_in_progress") return { ok: false, error: "Settlement isn't in progress." }
  const files = cleanFiles(input.files, 10)
  if (!(await verifyUploads(user!.id, files))) return { ok: false, error: "Please re-upload the photos." }
  const db = supabaseAdmin()
  const { data: s } = await db.from("settlements").select("id, customer_accepted_at, restoration_confirmed_at").eq("claim_id", id).single()
  const now = new Date().toISOString()
  await db
    .from("settlements")
    .update({
      bank_verified: !!input.bank_verified,
      // Only a reference (e.g. last 4 digits / UTR) — full bank details are never stored here.
      bank_reference: input.bank_reference.trim().slice(0, 40) || null,
      replacement_details: input.replacement_details.trim().slice(0, 500) || null,
      payment_reference: input.payment_reference.trim().slice(0, 60) || null,
      customer_accepted_at: input.customer_accepted ? (s?.customer_accepted_at ?? now) : null,
      restoration_confirmed_at: input.restoration_confirmed ? (s?.restoration_confirmed_at ?? now) : null,
      notes: input.notes.trim().slice(0, 1000) || null,
      updated_by: a.staff.id,
    })
    .eq("claim_id", id)
  if (files.length)
    await db.from("documents").insert(files.map((f) => ({ registration_id: c.registration_id, claim_id: id, kind: "settlement_photo", ...f, uploaded_by_staff: a.staff.id })))
  await audit({ registration_id: c.registration_id, claim_id: id, entity: "claim", action: "settlement_updated", actor_staff: a.staff.id, actor_label: staffLabel(a.staff), data: { bank_verified: input.bank_verified, customer_accepted: input.customer_accepted, restoration_confirmed: input.restoration_confirmed, photos: files.length } })
  return done()
}

export async function completeSettlement(id: string): Promise<ActionResult> {
  const a = await staffForAction(["finance"])
  if (!a.ok) return a
  const c = await claim(id)
  if (!c) return { ok: false, error: "Not found." }
  const db = supabaseAdmin()
  const { data: s } = await db.from("settlements").select("id, customer_accepted_at, restoration_confirmed_at").eq("claim_id", id).single()
  const { count: photos } = await db.from("documents").select("id", { count: "exact", head: true }).eq("claim_id", id).eq("kind", "settlement_photo")
  if (!s?.customer_accepted_at || !s.restoration_confirmed_at) return { ok: false, error: "Record customer acceptance and restoration completion first." }
  if (!photos) return { ok: false, error: "Add before-and-after photos first." }
  await db.from("settlements").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", s.id)
  const res = await moveClaim(a.staff, id, ["settlement_in_progress"], "settlement_completed", { action: "settlement_completed", visible_to_customer: true, customer_message: "Settlement completed" })
  if (res.ok) await notify("settlement_completed", c.email, { name: c.name, claim_no: c.claim_no, slug: c.slug }, { registration_id: c.registration_id, claim_id: id })
  return res
}

export async function closeClaim(id: string): Promise<ActionResult> {
  const a = await staffForAction(["finance"])
  if (!a.ok) return a
  const c = await claim(id)
  if (!c) return { ok: false, error: "Not found." }
  // Closing records the compensated quantity as utilised (policy 2.3).
  const res = await moveClaim(a.staff, id, ["settlement_completed"], "closed", { action: "closed", data: { utilised_qty: c.approved_qty }, visible_to_customer: true, customer_message: "Claim closed — closure certificate issued" }, { approved_qty: c.approved_qty })
  if (res.ok) await notify("claim_closed", c.email, { name: c.name, claim_no: c.claim_no, slug: c.slug }, { registration_id: c.registration_id, claim_id: id })
  return res
}
