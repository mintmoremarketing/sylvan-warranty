"use server"

import { revalidatePath } from "next/cache"

import { audit } from "@/lib/audit"
import { getAuthUser, hasRole, staffForAction, staffLabel } from "@/lib/auth"
import { formatDateTime } from "@/lib/domain/dates"
import { formFor, validateInspection, type InspectionAnswers } from "@/lib/domain/inspection-forms"
import { toSlug } from "@/lib/domain/numbers"
import { notify } from "@/lib/notify"
import { getSettings } from "@/lib/settings"
import { cleanFiles, verifyUploads } from "@/lib/storage"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { moveClaim, moveRegistration, slaFromNow, type ActionResult } from "@/lib/workflow"

const OPEN = ["assigned", "scheduled", "revisit_required"]

async function loadInspection(id: string) {
  const { data } = await supabaseAdmin()
    .from("inspections")
    .select("id, kind, status, inspector_id, registration_id, claim_id, registrations(wrn, status, owner_name, owner_email), claims(claim_no), staff:inspector_id(full_name)")
    .eq("id", id)
    .maybeSingle()
  if (!data) return null
  return {
    ...data,
    reg: data.registrations as unknown as { wrn: string; status: string; owner_name: string; owner_email: string },
    claimNo: (data.claims as unknown as { claim_no: string } | null)?.claim_no ?? null,
    inspectorName: (data.staff as unknown as { full_name: string }).full_name,
  }
}

export async function scheduleInspection(id: string, when: string): Promise<ActionResult> {
  const a = await staffForAction(["inspector", "verifier"])
  if (!a.ok) return a
  const insp = await loadInspection(id)
  if (!insp || !OPEN.includes(insp.status)) return { ok: false, error: "Inspection not found or already done." }
  if (insp.inspector_id !== a.staff.id && !hasRole(a.staff, ["verifier"])) return { ok: false, error: "This inspection isn't assigned to you." }
  const at = new Date(when)
  if (isNaN(at.getTime()) || at.getTime() < Date.now() - 3_600_000) return { ok: false, error: "Choose a date and time in the future." }

  await supabaseAdmin().from("inspections").update({ scheduled_at: at.toISOString(), status: "scheduled" }).eq("id", id)
  const ref = insp.claimNo ?? insp.reg.wrn
  const path = insp.claimNo ? `/my/claims/${toSlug(insp.claimNo)}` : `/my/registrations/${toSlug(insp.reg.wrn)}`

  if (insp.kind === "claim" && insp.claim_id) {
    const { data: c } = await supabaseAdmin().from("claims").select("status").eq("id", insp.claim_id).single()
    if (c?.status === "inspection_required")
      await moveClaim(a.staff, insp.claim_id, ["inspection_required"], "inspection_scheduled", { action: "inspection_scheduled", visible_to_customer: true, customer_message: "Inspection scheduled", data: { at: at.toISOString() } })
  }
  await audit({
    registration_id: insp.registration_id,
    claim_id: insp.claim_id,
    entity: "inspection",
    action: "inspection_scheduled",
    actor_staff: a.staff.id,
    actor_label: staffLabel(a.staff),
    data: { inspection_id: id, at: at.toISOString() },
    visible_to_customer: true,
    customer_message: `Site inspection scheduled for ${formatDateTime(at)}`,
  })
  await notify("inspection_scheduled", insp.reg.owner_email, { name: insp.reg.owner_name, ref, when: formatDateTime(at), inspector: insp.inspectorName, path }, { registration_id: insp.registration_id, claim_id: insp.claim_id ?? undefined })
  revalidatePath("/console", "layout")
  return { ok: true }
}

export type InspectionSubmission = {
  answers: InspectionAnswers
  media: Record<string, unknown>
  geo: { lat: number; lng: number; accuracy: number } | null
  geoNote: string
  ackName: string
  ackConfirmed: boolean
  declared: boolean
  outcome: "completed" | "revisit_required"
}

export async function submitInspection(id: string, raw: InspectionSubmission): Promise<ActionResult & { errors?: Record<string, string> }> {
  const a = await staffForAction(["inspector"])
  if (!a.ok) return a
  const user = await getAuthUser()
  const insp = await loadInspection(id)
  if (!insp || !OPEN.includes(insp.status)) return { ok: false, error: "Inspection not found or already submitted." }
  if (insp.inspector_id !== a.staff.id && !hasRole(a.staff, ["admin"])) return { ok: false, error: "This inspection isn't assigned to you." }

  const form = formFor(insp.kind as "registration" | "claim")
  const values = Object.fromEntries(Object.entries(raw.answers?.values ?? {}).map(([k, v]) => [k.slice(0, 60), String(v ?? "").slice(0, 2000)]))
  const notes = Object.fromEntries(Object.entries(raw.answers?.notes ?? {}).map(([k, v]) => [k.slice(0, 60), String(v ?? "").slice(0, 2000)]))
  const media = Object.fromEntries(Object.entries(raw.media ?? {}).map(([k, v]) => [k.slice(0, 80), cleanFiles(v, 20)]))
  const counts = Object.fromEntries(Object.entries(media).map(([k, v]) => [k, v.length]))
  const allFiles = Object.values(media).flat()

  const errors: Record<string, string> = {}
  if (raw.outcome === "completed") Object.assign(errors, validateInspection(form, { values, notes }, counts))
  else if (!(values.remarks ?? "").trim()) errors.remarks = "Explain why a revisit is needed"
  if (!raw.geo && (raw.geoNote ?? "").trim().length < 5) errors.geo = "Capture the location, or explain why it isn't available"
  if (!raw.declared) errors.declared = "Confirm the inspector declaration"
  if (raw.outcome === "completed" && (!raw.ackConfirmed || !(raw.ackName ?? "").trim())) errors.ack = "Record the customer / site owner acknowledgement"
  if (!(await verifyUploads(user!.id, allFiles))) errors.form = "Some photos didn't upload. Please re-add them."
  if (Object.keys(errors).length) return { ok: false, error: "Please complete the highlighted items.", errors }

  const db = supabaseAdmin()
  if (allFiles.length) {
    await db.from("documents").insert(
      Object.entries(media).flatMap(([key, files]) =>
        files.map((f) => ({
          registration_id: insp.registration_id,
          claim_id: insp.claim_id,
          inspection_id: id,
          kind: `inspection:${key}`,
          ...f,
          uploaded_by_staff: a.staff.id,
        }))
      )
    )
  }
  const now = new Date().toISOString()
  await db
    .from("inspections")
    .update({
      status: raw.outcome,
      form_version: form.version,
      answers: { values, notes, geo_note: raw.geo ? null : raw.geoNote },
      geo_lat: raw.geo?.lat ?? null,
      geo_lng: raw.geo?.lng ?? null,
      geo_accuracy_m: raw.geo?.accuracy ?? null,
      customer_ack_name: raw.ackConfirmed ? raw.ackName.trim().slice(0, 80) : null,
      customer_ack_at: raw.ackConfirmed ? now : null,
      inspector_declared_at: now,
      submitted_at: now,
    })
    .eq("id", id)

  const ref = insp.claimNo ?? insp.reg.wrn
  const path = insp.claimNo ? `/my/claims/${toSlug(insp.claimNo)}` : `/my/registrations/${toSlug(insp.reg.wrn)}`

  if (raw.outcome === "revisit_required") {
    await audit({
      registration_id: insp.registration_id,
      claim_id: insp.claim_id,
      entity: "inspection",
      action: "revisit_required",
      actor_staff: a.staff.id,
      actor_label: staffLabel(a.staff),
      remarks: values.remarks,
      data: { inspection_id: id },
      visible_to_customer: true,
      customer_message: "Inspection incomplete: revisit required",
    })
    revalidatePath("/console", "layout")
    return { ok: true }
  }

  const settings = await getSettings()
  const event = { action: "inspection_completed", data: { inspection_id: id }, visible_to_customer: true, customer_message: "Site inspection completed" }
  const res =
    insp.kind === "claim" && insp.claim_id
      ? await moveClaim(a.staff, insp.claim_id, ["inspection_scheduled", "inspection_required"], "inspection_completed", event)
      : insp.reg.status === "inspector_assigned"
        ? await moveRegistration(a.staff, insp.registration_id, ["inspector_assigned"], "inspection_completed", event, {
            sla_due_at: await slaFromNow(settings.sla.inspection_to_certificate_hours),
          })
        : // A visit asked for outside the SylvanCare+ flow (from the e-warranty review) is only recorded.
          (await audit({ registration_id: insp.registration_id, entity: "inspection", actor_staff: a.staff.id, actor_label: staffLabel(a.staff), ...event }), { ok: true as const })
  if (!res.ok) return res
  await notify("inspection_completed", insp.reg.owner_email, { name: insp.reg.owner_name, ref, path }, { registration_id: insp.registration_id, claim_id: insp.claim_id ?? undefined })
  return { ok: true }
}
