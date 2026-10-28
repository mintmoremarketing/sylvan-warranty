"use server"

import { randomBytes } from "node:crypto"
import { revalidatePath } from "next/cache"

import { audit } from "@/lib/audit"
import { staffForAction, staffLabel } from "@/lib/auth"
import { ROLE_LABELS, ROLES, type Role } from "@/lib/domain/constants"
import { EMAIL_RE, NAME_RE } from "@/lib/domain/registration"
import { notify } from "@/lib/notify"
import { supabaseAdmin } from "@/lib/supabase/admin"
import type { ActionResult } from "@/lib/workflow"

const tempPassword = () => `Syl-${randomBytes(6).toString("base64url")}`
const done = () => {
  revalidatePath("/console", "layout")
  return { ok: true } as const
}
const cleanRoles = (roles: string[]) => roles.filter((r): r is Role => (ROLES as readonly string[]).includes(r))

// ---------------------------------------------------------------- staff

export async function createStaff(input: { full_name: string; email: string; designation: string; roles: string[]; regions: string }): Promise<ActionResult & { password?: string }> {
  const a = await staffForAction(["admin"])
  if (!a.ok) return a
  const email = input.email.trim().toLowerCase()
  const roles = cleanRoles(input.roles)
  if (!NAME_RE.test(input.full_name.trim())) return { ok: false, error: "Enter a valid name." }
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Enter a valid email." }
  if (!roles.length) return { ok: false, error: "Choose at least one role." }

  const db = supabaseAdmin()
  const password = tempPassword()
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data.user) return { ok: false, error: error?.message.includes("already") ? "A user with this email already exists." : "Couldn't create the account." }
  const regions = input.regions.split(",").map((r) => r.trim().toUpperCase()).filter(Boolean)
  const { error: insertError } = await db.from("staff").insert({ id: data.user.id, email, full_name: input.full_name.trim(), designation: input.designation.trim() || null, roles, regions })
  if (insertError) {
    await db.auth.admin.deleteUser(data.user.id)
    return { ok: false, error: "Couldn't save the staff record." }
  }
  await audit({ entity: "settings", action: "staff_created", actor_staff: a.staff.id, actor_label: staffLabel(a.staff), data: { email, roles } })
  await notify("staff_welcome", email, { name: input.full_name.trim(), roles: roles.map((r) => ROLE_LABELS[r]).join(", ") })
  revalidatePath("/console", "layout")
  // Shown once to the admin, who shares it with the person; it is never emailed or stored.
  return { ok: true, password }
}

export async function updateStaff(id: string, input: { designation: string; roles: string[]; regions: string; active: boolean }): Promise<ActionResult> {
  const a = await staffForAction(["admin"])
  if (!a.ok) return a
  const roles = cleanRoles(input.roles)
  if (!roles.length) return { ok: false, error: "Choose at least one role." }
  if (id === a.staff.id && (!roles.includes("admin") || !input.active)) return { ok: false, error: "You can't remove your own admin access." }
  const regions = input.regions.split(",").map((r) => r.trim().toUpperCase()).filter(Boolean)
  await supabaseAdmin().from("staff").update({ designation: input.designation.trim() || null, roles, regions, active: input.active }).eq("id", id)
  await audit({ entity: "settings", action: "staff_updated", actor_staff: a.staff.id, actor_label: staffLabel(a.staff), data: { staff_id: id, roles, active: input.active } })
  return done()
}

export async function resetStaffPassword(id: string): Promise<ActionResult & { password?: string }> {
  const a = await staffForAction(["admin"])
  if (!a.ok) return a
  const password = tempPassword()
  const { error } = await supabaseAdmin().auth.admin.updateUserById(id, { password })
  if (error) return { ok: false, error: "Couldn't reset the password." }
  await audit({ entity: "settings", action: "staff_password_reset", actor_staff: a.staff.id, actor_label: staffLabel(a.staff), data: { staff_id: id } })
  return { ok: true, password }
}

// ---------------------------------------------------------------- products

export async function updateProduct(id: string, input: { standard_period: string; lifetime_multiplier: string; care_plus_years: string; coverage_note: string; active: boolean }): Promise<ActionResult> {
  const a = await staffForAction(["admin"])
  if (!a.ok) return a
  const years = input.care_plus_years.trim() ? Number(input.care_plus_years) : null
  if (years !== null && !(Number.isInteger(years) && years > 0 && years <= 50)) return { ok: false, error: "SylvanCare+ years must be a whole number." }
  const db = supabaseAdmin()
  const { data: before } = await db.from("products").select("name, category, standard_period, lifetime_multiplier, care_plus_years, active").eq("id", id).single()
  if (years !== null && before?.category !== "plywood") return { ok: false, error: "SylvanCare+ applies to plywood only (policy 1.2)." }
  const after = {
    standard_period: input.standard_period.trim() || null,
    lifetime_multiplier: input.lifetime_multiplier.trim() || null,
    care_plus_years: years,
    coverage_note: input.coverage_note.trim() || null,
    active: input.active,
  }
  await db.from("products").update(after).eq("id", id)
  await audit({ entity: "settings", action: "product_updated", actor_staff: a.staff.id, actor_label: staffLabel(a.staff), data: { product: `${before?.name} (${before?.category})`, before, after } })
  return done()
}

// ---------------------------------------------------------------- general

export type GeneralInput = {
  days: number[]
  start: string
  end: string
  registration_hours: string
  inspection_to_certificate_hours: string
  claim_screening_hours: string
  care_window_days: string
  standard_window_days: string
  manufacture_check: "invoice_date" | "batch_code"
}

export async function updateGeneral(input: GeneralInput): Promise<ActionResult> {
  const a = await staffForAction(["admin"])
  if (!a.ok) return a
  const n = (v: string) => Number(v)
  const hours = [n(input.registration_hours), n(input.inspection_to_certificate_hours), n(input.claim_screening_hours)]
  if (hours.some((h) => !Number.isInteger(h) || h < 1 || h > 500)) return { ok: false, error: "SLA hours must be whole numbers." }
  if (!/^\d{2}:\d{2}$/.test(input.start) || !/^\d{2}:\d{2}$/.test(input.end) || input.start >= input.end) return { ok: false, error: "Check the working hours." }
  const days = [...new Set(input.days)].filter((d) => d >= 0 && d <= 6).sort()
  if (!days.length) return { ok: false, error: "Choose at least one working day." }
  const careWindow = n(input.care_window_days)
  const stdWindow = n(input.standard_window_days)
  if (![careWindow, stdWindow].every((d) => Number.isInteger(d) && d > 0 && d <= 365)) return { ok: false, error: "Registration windows must be whole days." }

  const db = supabaseAdmin()
  const { data: care } = await db.from("app_settings").select("value").eq("key", "care_plus").single()
  const updates = [
    { key: "working_hours", value: { days, start: input.start, end: input.end } },
    { key: "sla", value: { registration_hours: hours[0], inspection_to_certificate_hours: hours[1], claim_screening_hours: hours[2] } },
    { key: "care_plus", value: { ...(care?.value ?? {}), window_days: careWindow, manufacture_check: input.manufacture_check } },
    { key: "standard", value: { window_days: stdWindow } },
  ]
  for (const u of updates) await db.from("app_settings").update({ value: u.value, updated_at: new Date().toISOString(), updated_by: a.staff.id }).eq("key", u.key)
  await audit({ entity: "settings", action: "rules_updated", actor_staff: a.staff.id, actor_label: staffLabel(a.staff), data: Object.fromEntries(updates.map((u) => [u.key, u.value])) })
  return done()
}

export async function addHoliday(day: string, name: string): Promise<ActionResult> {
  const a = await staffForAction(["admin"])
  if (!a.ok) return a
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !name.trim()) return { ok: false, error: "Enter the date and name." }
  const { error } = await supabaseAdmin().from("holidays").upsert({ day, name: name.trim().slice(0, 80) })
  if (error) return { ok: false, error: "Couldn't save." }
  return done()
}

export async function removeHoliday(day: string): Promise<ActionResult> {
  const a = await staffForAction(["admin"])
  if (!a.ok) return a
  await supabaseAdmin().from("holidays").delete().eq("day", day)
  return done()
}
