import { supabaseAdmin } from "@/lib/supabase/admin"

export type AuditEvent = {
  registration_id?: string | null
  claim_id?: string | null
  e_warranty_id?: string | null
  entity: "registration" | "claim" | "e_warranty" | "inspection" | "settings"
  action: string
  from_status?: string | null
  to_status?: string | null
  actor_staff?: string | null
  actor_customer?: string | null
  actor_label: string
  remarks?: string | null
  data?: Record<string, unknown>
  visible_to_customer?: boolean
  customer_message?: string | null
}

/** Appends to the permanent audit trail (the table rejects updates and deletes). */
export async function audit(event: AuditEvent) {
  const { error } = await supabaseAdmin().rpc("audit_from_json", { p: event })
  if (error) throw new Error(`audit failed: ${error.message}`)
}
