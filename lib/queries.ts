import { supabaseAdmin } from "@/lib/supabase/admin"
import { signedUrls } from "@/lib/storage"

export type Doc = {
  id: string
  kind: string
  path: string
  file_name: string
  content_type: string
  size_bytes: number
  invoice_id: string | null
  claim_id: string | null
  inspection_id: string | null
  info_request_id: string | null
  created_at: string
  url?: string
}

export type RegistrationItem = {
  id: string
  invoice_id: string
  product_id: string
  product_name: string
  category: string
  qty_purchased: number
  qty_used: number
  care_plus: boolean
  standard: boolean
  care_start: string | null
  care_expiry: string | null
  utilised_qty: number
}

export type RegistrationInvoice = {
  id: string
  position: number
  invoice_number: string
  invoice_date: string
  dealer_id: string | null
  dealer_name: string
  dealer_phone: string | null
  dealer_gstin: string | null
  batch_code: string | null
}

export type EWarranty = {
  id: string
  program: string
  number: string | null
  status: "pending_review" | "issued" | "rejected"
  customer_name: string
  customer_mobile: string
  customer_address: string
  dealer_name: string
  invoice_number: string
  invoice_date: string
  coordinator_id: string | null
  issued_at: string | null
  reject_reason: string | null
  e_warranty_items: { id: string; product_id: string; product_name: string; category: string; qty: number; warranty_period: string; invoice_number: string }[]
}

export type InfoRequest = {
  id: string
  registration_id: string | null
  claim_id: string | null
  requested_items: string[]
  remarks: string
  requested_at: string
  response_note: string | null
  responded_at: string | null
}

export type Inspection = {
  id: string
  kind: "registration" | "claim"
  claim_id: string | null
  inspector_id: string
  scheduled_at: string | null
  status: string
  answers: Record<string, unknown>
  form_version: string | null
  geo_lat: number | null
  geo_lng: number | null
  geo_accuracy_m: number | null
  customer_ack_name: string | null
  customer_ack_at: string | null
  submitted_at: string | null
  created_at: string
  staff: { full_name: string } | null
}

export type AuditRow = {
  id: number
  entity: string
  action: string
  from_status: string | null
  to_status: string | null
  actor_label: string
  remarks: string | null
  data: Record<string, unknown>
  visible_to_customer: boolean
  customer_message: string | null
  created_at: string
}

export type Registration = {
  id: string
  wrn: string
  customer_id: string
  channel: string
  created_by_staff: string | null
  owner_name: string
  owner_email: string
  owner_mobile: string
  site_address: string
  city: string
  district: string
  state: string
  pincode: string
  property_type: string | null
  installation_status: string | null
  application_areas: string[]
  carpenter_name: string | null
  carpenter_mobile: string | null
  referred_by: string | null
  referrer_name: string | null
  referrer_mobile: string | null
  referrer_email: string | null
  care_plus: boolean
  status: string
  inspection_needed: boolean | null
  inspection_reason: string | null
  verification: { checks: Record<string, "ok" | "issue">; remarks: string | null } | null
  verified_by: string | null
  verified_at: string | null
  sla_due_at: string | null
  activated_at: string | null
  claim_locked_at: string | null
  submitted_at: string
}

export type RegistrationDetail = Registration & {
  invoices: RegistrationInvoice[]
  items: RegistrationItem[]
  documents: Doc[]
  eWarranties: EWarranty[]
  infoRequests: InfoRequest[]
  inspections: Inspection[]
  audit: AuditRow[]
  claim: { id: string; claim_no: string; status: string; submitted_at: string } | null
}

/** Everything about one registration, with short-lived links to its files. Callers check access. */
export async function loadRegistration(wrn: string): Promise<RegistrationDetail | null> {
  const db = supabaseAdmin()
  const { data: reg } = await db.from("registrations").select("*").eq("wrn", wrn).maybeSingle()
  if (!reg) return null

  const [invoices, items, documents, eWarranties, infoRequests, inspections, audit, claim] = await Promise.all([
    db.from("registration_invoices").select("*").eq("registration_id", reg.id).order("position"),
    db.from("registration_items").select("*").eq("registration_id", reg.id),
    db.from("documents").select("*").eq("registration_id", reg.id).order("created_at"),
    db.from("e_warranties").select("*, e_warranty_items(*)").eq("registration_id", reg.id).order("program"),
    db.from("info_requests").select("*").eq("registration_id", reg.id).is("claim_id", null).order("requested_at"),
    db.from("inspections").select("*, staff:inspector_id(full_name)").eq("registration_id", reg.id).order("created_at"),
    db.from("audit_events").select("*").eq("registration_id", reg.id).is("claim_id", null).order("created_at"),
    db.from("claims").select("id, claim_no, status, submitted_at").eq("registration_id", reg.id).maybeSingle(),
  ])

  const docs = (documents.data ?? []) as Doc[]
  const urls = await signedUrls(docs.map((d) => d.path))
  for (const d of docs) d.url = urls[d.path]

  return {
    ...(reg as Registration),
    invoices: (invoices.data ?? []) as RegistrationInvoice[],
    items: (items.data ?? []) as RegistrationItem[],
    documents: docs,
    eWarranties: (eWarranties.data ?? []) as EWarranty[],
    infoRequests: (infoRequests.data ?? []) as InfoRequest[],
    inspections: (inspections.data ?? []) as unknown as Inspection[],
    audit: (audit.data ?? []) as AuditRow[],
    claim: claim.data ?? null,
  }
}

export async function rejectionReason(registrationId: string) {
  const { data } = await supabaseAdmin()
    .from("audit_events")
    .select("data, remarks")
    .eq("registration_id", registrationId)
    .eq("action", "rejected")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ? { reason: (data.data as { reason_label?: string }).reason_label ?? "", remarks: data.remarks } : null
}

export type Claim = {
  id: string
  claim_no: string
  registration_id: string
  customer_id: string
  item_id: string
  complaint_type: string
  affected_qty: number
  noticed_on: string
  description: string
  channel: string
  status: string
  screening: Record<string, unknown>
  finding_code: string | null
  decision: "approved" | "partially_approved" | "rejected" | null
  decision_remarks: string | null
  decided_by: string | null
  decided_at: string | null
  approved_qty: number | null
  sla_due_at: string | null
  closed_at: string | null
  submitted_at: string
}

export type ClaimDetail = Claim & {
  registration: RegistrationDetail
  item: RegistrationItem | undefined
  documents: Doc[]
  infoRequests: InfoRequest[]
  inspections: Inspection[]
  audit: AuditRow[]
  samples: { id: string; seal_no: string; description: string; collected_at: string; customer_ack: boolean; custody_events: { id: string; event: string; location: string; handled_by: string; at: string }[] }[]
  labReports: { id: string; lab_name: string; report_no: string | null; report_date: string; result: string; summary: string; document_id: string | null }[]
  compensation: {
    id: string
    lines: { key: string; label: string; claimed: number | null; estimate: number | null; payable: number }[]
    total_payable: number
    prepared_by: string
    prepared_at: string
    approved_by: string | null
    approved_at: string | null
    finance_approved_by: string | null
    finance_approved_at: string | null
  } | null
  settlement: {
    id: string
    mode: string
    status: string
    bank_verified: boolean
    bank_reference: string | null
    replacement_details: string | null
    payment_reference: string | null
    customer_accepted_at: string | null
    restoration_confirmed_at: string | null
    notes: string | null
    completed_at: string | null
  } | null
}

export async function loadClaim(claimNo: string): Promise<ClaimDetail | null> {
  const db = supabaseAdmin()
  const { data: claim } = await db.from("claims").select("*").eq("claim_no", claimNo).maybeSingle()
  if (!claim) return null
  const { data: regRow } = await db.from("registrations").select("wrn").eq("id", claim.registration_id).single()
  const registration = (await loadRegistration(regRow!.wrn))!

  const [documents, infoRequests, inspections, audit, samples, labReports, compensation, settlement] = await Promise.all([
    db.from("documents").select("*").eq("claim_id", claim.id).order("created_at"),
    db.from("info_requests").select("*").eq("claim_id", claim.id).order("requested_at"),
    db.from("inspections").select("*, staff:inspector_id(full_name)").eq("claim_id", claim.id).order("created_at"),
    db.from("audit_events").select("*").eq("claim_id", claim.id).order("created_at"),
    db.from("samples").select("*, custody_events(*)").eq("claim_id", claim.id).order("created_at"),
    db.from("lab_reports").select("*").eq("claim_id", claim.id).order("created_at"),
    db.from("compensation_sheets").select("*").eq("claim_id", claim.id).maybeSingle(),
    db.from("settlements").select("*").eq("claim_id", claim.id).maybeSingle(),
  ])
  const docs = (documents.data ?? []) as Doc[]
  const urls = await signedUrls(docs.map((d) => d.path))
  for (const d of docs) d.url = urls[d.path]

  return {
    ...(claim as Claim),
    registration,
    item: registration.items.find((i) => i.id === claim.item_id),
    documents: docs,
    infoRequests: (infoRequests.data ?? []) as InfoRequest[],
    inspections: (inspections.data ?? []) as unknown as Inspection[],
    audit: (audit.data ?? []) as AuditRow[],
    samples: (samples.data ?? []) as ClaimDetail["samples"],
    labReports: (labReports.data ?? []) as ClaimDetail["labReports"],
    compensation: (compensation.data as ClaimDetail["compensation"]) ?? null,
    settlement: (settlement.data as ClaimDetail["settlement"]) ?? null,
  }
}
