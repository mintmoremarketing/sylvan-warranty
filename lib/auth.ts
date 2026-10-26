import { cache } from "react"
import { redirect } from "next/navigation"

import { ROLE_LABELS, type Role } from "@/lib/domain/constants"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { supabaseServer } from "@/lib/supabase/server"

export type Staff = {
  id: string
  full_name: string
  email: string
  phone: string | null
  designation: string | null
  roles: Role[]
  regions: string[]
  active: boolean
}

export type Customer = {
  id: string
  auth_user_id: string | null
  email: string
  full_name: string | null
  mobile: string | null
}

/** The signed-in Supabase user, verified with the auth server. */
export const getAuthUser = cache(async () => {
  const supabase = await supabaseServer()
  const { data } = await supabase.auth.getUser()
  return data.user ?? null
})

export const getStaff = cache(async (): Promise<Staff | null> => {
  const user = await getAuthUser()
  if (!user) return null
  const { data } = await supabaseAdmin()
    .from("staff")
    .select("id, full_name, email, phone, designation, roles, regions, active")
    .eq("id", user.id)
    .eq("active", true)
    .maybeSingle()
  return (data as Staff | null) ?? null
})

export function hasRole(staff: Pick<Staff, "roles">, roles: readonly Role[]) {
  return staff.roles.includes("admin") || roles.some((r) => staff.roles.includes(r))
}

export async function requireStaff(roles?: readonly Role[], returnTo = "/console") {
  const staff = await getStaff()
  if (!staff) redirect(`/console/login?next=${encodeURIComponent(returnTo)}`)
  if (roles && !hasRole(staff, roles)) redirect("/console?denied=1")
  return staff
}

/** For server actions: the staff member, or an error message instead of a redirect. */
export async function staffForAction(
  roles?: readonly Role[]
): Promise<{ ok: false; error: string } | { ok: true; staff: Staff }> {
  const staff = await getStaff()
  if (!staff) return { ok: false, error: "Your session has expired. Please log in again." }
  if (roles && !hasRole(staff, roles)) return { ok: false, error: "You don't have permission to do this." }
  return { ok: true, staff }
}

export function staffLabel(staff: Pick<Staff, "full_name" | "roles">) {
  const role = staff.roles.find((r) => r !== "admin") ?? staff.roles[0]
  return `${staff.full_name} (${ROLE_LABELS[role]})`
}

/**
 * The customer record for the signed-in user. Customers are keyed by email, so a registration
 * customer care made on someone's behalf is linked the first time they log in.
 */
export const getCustomer = cache(async (): Promise<Customer | null> => {
  const user = await getAuthUser()
  if (!user?.email) return null
  const db = supabaseAdmin()
  const cols = "id, auth_user_id, email, full_name, mobile"

  const { data: linked } = await db.from("customers").select(cols).eq("auth_user_id", user.id).maybeSingle()
  if (linked) return linked as Customer

  const email = user.email.toLowerCase()
  const { data: byEmail } = await db.from("customers").select(cols).eq("email", email).maybeSingle()
  if (byEmail) {
    if (!byEmail.auth_user_id) {
      await db.from("customers").update({ auth_user_id: user.id }).eq("id", byEmail.id)
      return { ...(byEmail as Customer), auth_user_id: user.id }
    }
    return byEmail as Customer
  }

  const { data: created } = await db
    .from("customers")
    .insert({ email, auth_user_id: user.id })
    .select(cols)
    .single()
  return (created as Customer | null) ?? null
})

export async function requireCustomer(returnTo = "/my") {
  const customer = await getCustomer()
  if (!customer) redirect(`/my/login?next=${encodeURIComponent(returnTo)}`)
  return customer
}

/** Only same-origin paths, so `?next=` can't be used as an open redirect. */
export function safeRedirectPath(next: string | undefined | null, fallback: string) {
  return next && /^\/(?![/\\])/.test(next) ? next : fallback
}
