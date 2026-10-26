import { revalidatePath } from "next/cache"

import type { AuditEvent } from "@/lib/audit"
import { staffLabel, type Staff } from "@/lib/auth"
import { addWorkingHours } from "@/lib/domain/sla"
import { getSettings } from "@/lib/settings"
import { supabaseAdmin } from "@/lib/supabase/admin"

export type ActionResult = { ok: true } | { ok: false; error: string }

type EventFields = Omit<AuditEvent, "entity" | "registration_id" | "claim_id" | "from_status" | "to_status" | "actor_label" | "actor_staff">

function friendly(message: string) {
  if (message.includes("invalid_transition")) return "This item has moved on since you opened it. Refresh and try again."
  if (message.includes("not_found")) return "Not found."
  return "Something went wrong. Please try again."
}

/** `staff` null means the system made the move (e.g. activating a warranty after approval). */
export async function moveRegistration(
  staff: Staff | null,
  id: string,
  from: string[],
  to: string,
  event: EventFields,
  set: Record<string, unknown> = {}
): Promise<ActionResult> {
  const { error } = await supabaseAdmin().rpc("transition_registration", {
    p_id: id,
    p_from: from,
    p_to: to,
    p_set: set,
    p_event: { ...event, actor_staff: staff?.id ?? null, actor_label: staff ? staffLabel(staff) : "System" },
  })
  if (error) {
    console.error("transition_registration", error.message)
    return { ok: false, error: friendly(error.message) }
  }
  revalidatePath("/console", "layout")
  return { ok: true }
}

export async function moveClaim(
  staff: Staff | null,
  id: string,
  from: string[],
  to: string,
  event: EventFields & { actor_label?: string },
  set: Record<string, unknown> = {}
): Promise<ActionResult> {
  const { error } = await supabaseAdmin().rpc("transition_claim", {
    p_id: id,
    p_from: from,
    p_to: to,
    p_set: set,
    p_event: { ...event, actor_staff: staff?.id ?? null, actor_label: staff ? staffLabel(staff) : (event.actor_label ?? "System") },
  })
  if (error) {
    console.error("transition_claim", error.message)
    return { ok: false, error: friendly(error.message) }
  }
  revalidatePath("/console", "layout")
  return { ok: true }
}

/** Due date `hours` working hours from now, for SLA timers. */
export async function slaFromNow(hours: number) {
  const s = await getSettings()
  return addWorkingHours(new Date(), hours, s.workingHours, s.holidays).toISOString()
}
