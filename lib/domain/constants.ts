// Labels and option lists shared by the portal and the console.

export const ROLES = [
  "admin",
  "customer_care",
  "verifier",
  "approver",
  "inspector",
  "sales_coordinator",
  "technical",
  "finance",
  "management",
] as const
export type Role = (typeof ROLES)[number]

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  customer_care: "Customer care",
  verifier: "Backend executive",
  approver: "HO approver",
  inspector: "Site inspector",
  sales_coordinator: "Sales coordinator",
  technical: "Technical (HO)",
  finance: "Finance",
  management: "Management",
}

export const CATEGORIES = [
  { value: "plywood", label: "Plywood" },
  { value: "blockboard", label: "Blockboard" },
  { value: "flush_door", label: "Flush door" },
  { value: "wpc", label: "WPC board" },
] as const
export type Category = (typeof CATEGORIES)[number]["value"]
export const categoryLabel = (c: string) =>
  CATEGORIES.find((x) => x.value === c)?.label ?? c

export const PROPERTY_TYPES = [
  { value: "apartment", label: "Apartment / flat" },
  { value: "independent_house", label: "Independent house / villa" },
  { value: "office", label: "Office" },
  { value: "shop", label: "Shop / showroom" },
  { value: "other", label: "Other" },
] as const

export const INSTALLATION_STATUSES = [
  { value: "not_started", label: "Not started yet" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
] as const

export const APPLICATION_AREAS = [
  "Kitchen",
  "Wardrobe",
  "Bed",
  "TV unit",
  "Doors",
  "Partitions",
  "Wall panelling",
  "Ceiling",
  "Office furniture",
  "Other",
] as const

export const REFERRAL_TYPES = [
  { value: "architect", label: "Architect" },
  { value: "interior_designer", label: "Interior designer" },
  { value: "sales_person", label: "Sylvan sales person" },
  { value: "other", label: "Other" },
] as const

export const COMPLAINT_TYPES = [
  "Delamination",
  "Bending / warping",
  "Termite attack",
  "Borer attack",
  "Fungus / decay",
  "Core gap",
  "Surface defect",
  "Thickness variation",
  "Screw / nail holding",
  "Other",
] as const

export const INFO_REQUEST_ITEMS = [
  "Clearer invoice copy",
  "Complete invoice (all pages)",
  "Invoice showing product name and quantity",
  "Dealer details",
  "Correct site address",
  "Site / installation photos",
  "Product branding / stamp photo",
  "Identity of the site owner",
  "Other",
] as const

/** Brief §3 "Backend Verification": what the authorised backend team checks, in the brief's order. */
export const VERIFICATION_CHECKS = [
  { key: "product_eligible", label: "Product is eligible under SylvanCare+" },
  { key: "manufacture_date", label: "Invoice date and manufacturing applicability meet the policy requirements" },
  { key: "within_period", label: "Registered within the permitted registration period" },
  { key: "invoice_valid", label: "Invoice is valid and readable" },
  { key: "product_quantity", label: "Product name and quantity" },
  { key: "dealer", label: "Dealer details" },
  { key: "owner", label: "Homeowner / site-owner details" },
  { key: "site_address", label: "Site address" },
  { key: "quantity_matches_invoice", label: "Registered quantity is consistent with the invoice" },
  { key: "not_already_registered", label: "Same invoice / product quantity not already registered" },
  { key: "no_duplicate", label: "No other duplicate registration" },
  { key: "nothing_missing", label: "No information or document missing or needing clarification" },
] as const
export type VerificationKey = (typeof VERIFICATION_CHECKS)[number]["key"]
export type VerificationResult = "ok" | "issue"

export const LABS = [
  "Sylvan in-house laboratory",
  "National Test House",
  "Shriram Test House, Delhi",
  "JBS Testing Solutions Pvt. Ltd., Punjab",
  "Unique Test House LLP, Punjab",
] as const

// ---------------------------------------------------------------------------
// Registration (SylvanCare+) statuses
// ---------------------------------------------------------------------------

export type RegistrationStatus =
  | "not_applicable"
  | "received"
  | "under_verification"
  | "info_required"
  | "inspection_required"
  | "inspector_assigned"
  | "inspection_completed"
  | "pending_approval"
  | "approved"
  | "active"
  | "rejected"

type Tone = "default" | "secondary" | "destructive" | "outline"

export const REGISTRATION_STATUS: Record<
  RegistrationStatus,
  { staff: string; customer: string; tone: Tone }
> = {
  not_applicable: { staff: "Standard only", customer: "Standard warranty only", tone: "outline" },
  received: { staff: "Registration received", customer: "Registration submitted", tone: "secondary" },
  under_verification: { staff: "Under verification", customer: "Under verification", tone: "secondary" },
  info_required: { staff: "Additional info required", customer: "Action required", tone: "destructive" },
  inspection_required: { staff: "Inspection required", customer: "Site inspection required", tone: "secondary" },
  inspector_assigned: { staff: "Inspector assigned", customer: "Site inspection scheduled", tone: "secondary" },
  inspection_completed: { staff: "Inspection completed", customer: "Inspection completed / under review", tone: "secondary" },
  // Internal sub-status; the brief says not to expose it to customers.
  pending_approval: { staff: "Pending approval", customer: "Under review", tone: "secondary" },
  approved: { staff: "Approved", customer: "Approved", tone: "default" },
  active: { staff: "Warranty active", customer: "Warranty active", tone: "default" },
  rejected: { staff: "Rejected", customer: "Rejected", tone: "destructive" },
}

export const REGISTRATION_QUEUES = [
  { key: "new", label: "New", statuses: ["received"] },
  { key: "verification", label: "Verifying", statuses: ["under_verification"] },
  { key: "info", label: "Info requested", statuses: ["info_required"] },
  { key: "inspection", label: "Inspection", statuses: ["inspection_required", "inspector_assigned", "inspection_completed"] },
  { key: "approval", label: "Approval", statuses: ["pending_approval", "inspection_completed"] },
  { key: "active", label: "Active", statuses: ["active"] },
  { key: "rejected", label: "Rejected", statuses: ["rejected"] },
  { key: "standard", label: "Standard only", statuses: ["not_applicable"] },
  { key: "all", label: "All", statuses: [] },
] as const

// ---------------------------------------------------------------------------
// Claim statuses
// ---------------------------------------------------------------------------

export type ClaimStatus =
  | "received"
  | "under_review"
  | "info_required"
  | "inspection_required"
  | "inspection_scheduled"
  | "inspection_completed"
  | "technical_review"
  | "further_testing"
  | "approved"
  | "partially_approved"
  | "rejected"
  | "settlement_in_progress"
  | "settlement_completed"
  | "closed"

export const CLAIM_STATUS: Record<ClaimStatus, { label: string; customer: string; tone: Tone }> = {
  received: { label: "Complaint received", customer: "Complaint received", tone: "secondary" },
  under_review: { label: "Pre-screening", customer: "Under review", tone: "secondary" },
  info_required: { label: "Additional info required", customer: "Action required", tone: "destructive" },
  inspection_required: { label: "Inspection required", customer: "Inspection required", tone: "secondary" },
  inspection_scheduled: { label: "Inspection scheduled", customer: "Inspection scheduled", tone: "secondary" },
  inspection_completed: { label: "Inspection completed", customer: "Inspection completed", tone: "secondary" },
  technical_review: { label: "Technical review", customer: "Under technical review", tone: "secondary" },
  further_testing: { label: "Further testing", customer: "Further testing required", tone: "secondary" },
  approved: { label: "Approved", customer: "Claim approved", tone: "default" },
  partially_approved: { label: "Partially approved", customer: "Claim partially approved", tone: "default" },
  rejected: { label: "Rejected", customer: "Claim rejected", tone: "destructive" },
  settlement_in_progress: { label: "Settlement in progress", customer: "Settlement in progress", tone: "default" },
  settlement_completed: { label: "Settlement completed", customer: "Settlement completed", tone: "default" },
  closed: { label: "Closed", customer: "Claim closed", tone: "outline" },
}

export const CLAIM_QUEUES = [
  { key: "screening", label: "Screening", statuses: ["received", "under_review"] },
  { key: "info", label: "Info requested", statuses: ["info_required"] },
  { key: "inspection", label: "Inspection", statuses: ["inspection_required", "inspection_scheduled", "inspection_completed"] },
  { key: "technical", label: "Technical", statuses: ["technical_review", "further_testing"] },
  { key: "settlement", label: "Settlement", statuses: ["approved", "partially_approved", "settlement_in_progress", "settlement_completed"] },
  { key: "done", label: "Closed / rejected", statuses: ["closed", "rejected"] },
  { key: "all", label: "All", statuses: [] },
] as const

export const E_WARRANTY_STATUS = {
  pending_review: { label: "Pending review", customer: "Being prepared", tone: "secondary" },
  issued: { label: "Issued", customer: "Issued", tone: "default" },
  rejected: { label: "Rejected", customer: "Not issued", tone: "destructive" },
} as const

export const INSPECTION_STATUS = {
  assigned: "Assigned",
  scheduled: "Scheduled",
  completed: "Completed",
  revisit_required: "Revisit required",
  cancelled: "Cancelled",
} as const
