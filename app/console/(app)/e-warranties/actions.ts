"use server"

import { revalidatePath } from "next/cache"

import { audit } from "@/lib/audit"
import { hasRole, staffForAction, staffLabel, type Staff } from "@/lib/auth"
import { toSlug } from "@/lib/domain/numbers"
import { MOBILE_RE, NAME_RE } from "@/lib/domain/registration"
import { notify } from "@/lib/notify"
import { supabaseAdmin } from "@/lib/supabase/admin"
import type { ActionResult } from "@/lib/workflow"

async function load(id: string, staff: Staff) {
  const { data } = await supabaseAdmin()
    .from("e_warranties")
    .select("*, e_warranty_items(*), registrations(wrn, owner_email, owner_name), warranty_programs(name)")
    .eq("id", id)
    .maybeSingle()
  if (!data) return null
  // Coordinators work on their own dealers' e-warranties; admins on any.
  if (data.coordinator_id !== staff.id && !hasRole(staff, ["admin"])) return null
  return data
}

export type EWarrantyEdit = {
  customer_name: string
  customer_mobile: string
  customer_address: string
  dealer_name: string
  invoice_number: string
  invoice_date: string
  coordinator_id: string
  items: { id: string; product_id: string; qty: string }[]
}

export async function saveEWarranty(id: string, edit: EWarrantyEdit): Promise<ActionResult> {
  const a = await staffForAction(["sales_coordinator"])
  if (!a.ok) return a
  const ew = await load(id, a.staff)
  if (!ew) return { ok: false, error: "Not found." }
  if (ew.status !== "pending_review") return { ok: false, error: "Issued or rejected e-warranties can't be edited." }

  const name = edit.customer_name.trim().slice(0, 80)
  const mobile = edit.customer_mobile.replace(/\D/g, "").slice(0, 10)
  if (!NAME_RE.test(name)) return { ok: false, error: "Enter a valid customer name." }
  if (!MOBILE_RE.test(mobile)) return { ok: false, error: "Enter a valid 10-digit mobile number." }
  if (edit.customer_address.trim().length < 10) return { ok: false, error: "Enter the full address." }
  if (!edit.dealer_name.trim() || !edit.invoice_number.trim()) return { ok: false, error: "Dealer and invoice number are required." }

  const db = supabaseAdmin()
  const productIds = [...new Set(edit.items.map((i) => i.product_id))]
  const { data: products } = await db.from("products").select("id, name, category, standard_program, standard_period").in("id", productIds)
  const byId = new Map((products ?? []).map((p) => [p.id, p]))
  for (const i of edit.items) {
    const p = byId.get(i.product_id)
    if (!p || p.standard_program !== ew.program) return { ok: false, error: "Each product must belong to this certificate type." }
    if (!(Number(i.qty) >= 1)) return { ok: false, error: "Quantities must be at least 1." }
  }

  const before = { customer_name: ew.customer_name, customer_mobile: ew.customer_mobile, customer_address: ew.customer_address, dealer_name: ew.dealer_name, invoice_number: ew.invoice_number, invoice_date: ew.invoice_date }
  const after = {
    customer_name: name,
    customer_mobile: mobile,
    customer_address: edit.customer_address.trim().slice(0, 400),
    dealer_name: edit.dealer_name.trim().slice(0, 120),
    invoice_number: edit.invoice_number.trim().slice(0, 40),
    // Brief: invoice date is editable for WPC only.
    invoice_date: ew.program === "WPC" && /^\d{4}-\d{2}-\d{2}$/.test(edit.invoice_date) ? edit.invoice_date : ew.invoice_date,
  }
  const coordinator = hasRole(a.staff, ["admin"]) && edit.coordinator_id ? edit.coordinator_id : ew.coordinator_id
  await db.from("e_warranties").update({ ...after, coordinator_id: coordinator }).eq("id", id)

  for (const i of edit.items) {
    const p = byId.get(i.product_id)!
    // Brief: quantity is editable for PLY / BB / FD only, not WPC.
    const qty = ew.program === "WPC" ? {} : { qty: Number(i.qty) }
    await db
      .from("e_warranty_items")
      .update({ product_id: p.id, product_name: p.name, category: p.category, warranty_period: p.standard_period, ...qty })
      .eq("id", i.id)
      .eq("e_warranty_id", id)
  }

  const changed = Object.fromEntries(Object.entries(after).filter(([k, v]) => before[k as keyof typeof before] !== v).map(([k, v]) => [k, { from: before[k as keyof typeof before], to: v }]))
  await audit({ registration_id: ew.registration_id, e_warranty_id: id, entity: "e_warranty", action: "edited", actor_staff: a.staff.id, actor_label: staffLabel(a.staff), data: { changed, items: edit.items.length } })
  revalidatePath("/console", "layout")
  return { ok: true }
}

export async function issueEWarranty(id: string): Promise<ActionResult> {
  const a = await staffForAction(["sales_coordinator"])
  if (!a.ok) return a
  const ew = await load(id, a.staff)
  if (!ew) return { ok: false, error: "Not found." }
  const { data: number, error } = await supabaseAdmin().rpc("issue_e_warranty", { p_id: id, p_staff: a.staff.id, p_label: staffLabel(a.staff) })
  if (error || typeof number !== "string") return { ok: false, error: "Couldn't issue — it may already be decided." }
  const reg = ew.registrations as unknown as { wrn: string; owner_email: string; owner_name: string }
  const program = (ew.warranty_programs as unknown as { name: string }).name
  await notify("e_warranty_issued", reg.owner_email, { name: ew.customer_name, number, program, slug: toSlug(reg.wrn) }, { registration_id: ew.registration_id })
  revalidatePath("/console", "layout")
  return { ok: true }
}

export async function rejectEWarranty(id: string, reason: string): Promise<ActionResult> {
  const a = await staffForAction(["sales_coordinator"])
  if (!a.ok) return a
  const ew = await load(id, a.staff)
  if (!ew || ew.status !== "pending_review") return { ok: false, error: "Not found or already decided." }
  const note = reason.trim().slice(0, 500)
  if (note.length < 5) return { ok: false, error: "Explain why it can't be issued." }
  await supabaseAdmin().from("e_warranties").update({ status: "rejected", reject_reason: note }).eq("id", id)
  await audit({ registration_id: ew.registration_id, e_warranty_id: id, entity: "e_warranty", action: "rejected", from_status: "pending_review", to_status: "rejected", actor_staff: a.staff.id, actor_label: staffLabel(a.staff), remarks: note, visible_to_customer: true, customer_message: "Standard e-warranty could not be issued" })
  revalidatePath("/console", "layout")
  return { ok: true }
}
