// Compensation sheet (policy 5.1–5.4): each line is paid at the lower of the claimant's actual
// invoice and Sylvan's internal estimate.

export const COMPENSATION_LINES = [
  { key: "sheets", label: "Defective / impacted sheets" },
  { key: "laminate", label: "Laminates" },
  { key: "adhesive", label: "Adhesives" },
  { key: "labour", label: "Labour — fitting and removal" },
  { key: "transport", label: "Transport (dealer to site)" },
  { key: "treatment", label: "Termite / borer treatment" },
  { key: "veneer", label: "Veneers" },
  { key: "furniture", label: "Affected portion of furniture (repair / replacement)" },
] as const

export type CompensationLine = { key: string; label: string; claimed: number | null; estimate: number | null; payable: number }

export function payable(claimed: number | null, estimate: number | null) {
  if (claimed == null && estimate == null) return 0
  if (claimed == null) return estimate!
  if (estimate == null) return claimed
  return Math.min(claimed, estimate)
}

export function computeSheet(raw: { key: string; claimed: string; estimate: string }[]): CompensationLine[] {
  const num = (v: string) => {
    const n = Number(String(v).replace(/[^\d.]/g, ""))
    return v === "" || !Number.isFinite(n) ? null : Math.round(n * 100) / 100
  }
  return COMPENSATION_LINES.map((l) => {
    const r = raw.find((x) => x.key === l.key)
    const claimed = r ? num(r.claimed) : null
    const estimate = r ? num(r.estimate) : null
    return { key: l.key, label: l.label, claimed, estimate, payable: payable(claimed, estimate) }
  })
}

export const SETTLEMENT_MODES = [
  { value: "reimbursement", label: "Reimbursement to bank account" },
  { value: "replacement", label: "Replacement of material" },
  { value: "repair", label: "Repair at site" },
  { value: "cash", label: "Cash / cheque" },
] as const

export const SCREENING_CHECKS = [
  { key: "active_warranty", label: "SylvanCare+ warranty is active", auto: true },
  { key: "within_period", label: "Claim is within the warranty period", auto: true },
  { key: "product_covered", label: "Affected product is covered", auto: true },
  { key: "qty_eligible", label: "Claimed quantity is within the covered quantity", auto: true },
  { key: "no_previous_claims", label: "No previous claim on this warranty", auto: true },
  { key: "registered_owner", label: "Claimant is the registered home / site owner", auto: false },
  { key: "invoice_reverified", label: "Invoice re-verified", auto: false },
  { key: "details_match", label: "Complaint matches registration details (owner, site, quantity)", auto: false },
  { key: "photo_review", label: "Initial photo review done", auto: false },
] as const
