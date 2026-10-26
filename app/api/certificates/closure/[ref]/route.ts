import { getCustomer, getStaff } from "@/lib/auth"
import { renderClosureCertificate } from "@/lib/certificates"
import { SETTLEMENT_MODES } from "@/lib/domain/compensation"
import { fromSlug } from "@/lib/domain/numbers"
import { supabaseAdmin } from "@/lib/supabase/admin"

export async function GET(_req: Request, { params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params
  const { data: c } = await supabaseAdmin()
    .from("claims")
    .select("claim_no, customer_id, status, complaint_type, decision, approved_qty, closed_at, registrations(wrn, owner_name, site_address, city, state, pincode), registration_items(product_name), compensation_sheets(total_payable), settlements(mode)")
    .eq("claim_no", fromSlug(ref))
    .maybeSingle()
  if (!c || c.status !== "closed") return new Response("Not found", { status: 404 })

  const [staff, customer] = await Promise.all([getStaff(), getCustomer()])
  if (!staff && customer?.id !== c.customer_id) return new Response("Not found", { status: 404 })

  const reg = c.registrations as unknown as { wrn: string; owner_name: string; site_address: string; city: string; state: string; pincode: string }
  const sheet = (Array.isArray(c.compensation_sheets) ? c.compensation_sheets[0] : c.compensation_sheets) as { total_payable: number } | null
  const settlement = (Array.isArray(c.settlements) ? c.settlements[0] : c.settlements) as { mode: string } | null
  const pdf = await renderClosureCertificate({
    claim_no: c.claim_no,
    wrn: reg.wrn,
    owner_name: reg.owner_name,
    site: `${reg.site_address}, ${reg.city}, ${reg.state} — ${reg.pincode}`,
    product: (c.registration_items as unknown as { product_name: string }).product_name,
    complaint_type: c.complaint_type,
    decision: c.decision === "partially_approved" ? "Partially approved" : "Approved",
    approved_qty: c.approved_qty,
    total_payable: sheet ? Number(sheet.total_payable) : null,
    settlement_mode: SETTLEMENT_MODES.find((m) => m.value === settlement?.mode)?.label ?? null,
    closed_at: c.closed_at!,
  })
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Closure-${ref}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  })
}
