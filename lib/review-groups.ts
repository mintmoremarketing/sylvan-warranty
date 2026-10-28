import type { ReviewGroup } from "@/components/console/product-review"
import { hasRole, type Staff } from "@/lib/auth"
import type { VerificationKey, VerificationResult } from "@/lib/domain/constants"
import { formatDateTime } from "@/lib/domain/dates"
import type { RegistrationDetail } from "@/lib/queries"

/**
 * The products of a registration grouped by the certificate they go on, with who may check each line now:
 * SylvanCare+ lines by the backend team / approver until the SylvanCare+ decision, standard lines also by the
 * sales coordinator until the e-warranty is decided.
 */
export function reviewGroups(
  reg: RegistrationDetail,
  staff: Staff,
  nameOf: Map<string, string>,
  only?: "care_plus" | "standard",
  /** What the system can already tell for the whole registration, offered as a starting point. */
  suggested: Partial<Record<VerificationKey, VerificationResult>> = {}
): ReviewGroup[] {
  const invoiceNo = new Map(reg.invoices.map((i) => [i.id, i.invoice_number]))
  const careOpen = !["active", "rejected", "approved", "not_applicable"].includes(reg.status) && hasRole(staff, ["verifier", "approver"])
  const ewOpen = reg.eWarranties.some((e) => e.status === "pending_review") && hasRole(staff, ["verifier", "approver", "sales_coordinator"])

  const line = (i: RegistrationDetail["items"][number], editable: boolean) => ({
    id: i.id,
    product_name: i.product_name,
    category: i.category,
    qty_purchased: i.qty_purchased,
    qty_used: i.qty_used,
    invoice_number: invoiceNo.get(i.invoice_id) ?? "—",
    review_status: i.review_status,
    review_note: i.review_note,
    checks: i.review_checks,
    suggested: { ...suggested, quantity_matches_invoice: i.qty_used <= i.qty_purchased ? "ok" : "issue" } as Partial<Record<VerificationKey, VerificationResult>>,
    care_plus: i.care_plus,
    reviewed: i.reviewed_at ? `${i.review_status === "approved" ? "Approved" : "Rejected"} by ${nameOf.get(i.reviewed_by ?? "") ?? "—"} · ${formatDateTime(i.reviewed_at)}` : null,
    editable,
  })

  const groups: ReviewGroup[] = []
  const care = reg.items.filter((i) => i.care_plus)
  const standard = reg.items.filter((i) => i.standard && !i.care_plus)
  if (care.length && only !== "standard")
    groups.push({
      key: "care_plus",
      title: "SylvanCare+ certificate",
      description: "Approved products are printed on the SylvanCare+ certificate when the registration is approved.",
      lines: care.map((i) => line(i, careOpen)),
    })
  if (standard.length && only !== "care_plus")
    groups.push({
      key: "standard",
      title: "Standard e-warranty",
      description: "Approved products are printed on one standard e-warranty when the sales coordinator issues it.",
      lines: standard.map((i) => line(i, ewOpen)),
    })
  return groups
}
