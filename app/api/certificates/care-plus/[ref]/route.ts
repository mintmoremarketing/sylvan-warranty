import { getCustomer, getStaff } from "@/lib/auth"
import { renderCarePlusCertificate } from "@/lib/certificates"
import { shiftDate, todayIST } from "@/lib/domain/dates"
import { fromSlug } from "@/lib/domain/numbers"
import { supabaseAdmin } from "@/lib/supabase/admin"

/** The SylvanCare+ certificate. `?preview=1` lets staff see it before approval, marked as a preview. */
export async function GET(req: Request, { params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params
  const preview = new URL(req.url).searchParams.get("preview") === "1"
  const wrn = fromSlug(ref)
  const db = supabaseAdmin()
  const { data: reg } = await db
    .from("registrations")
    .select("id, wrn, customer_id, owner_name, owner_mobile, site_address, city, district, state, pincode, status, activated_at, registration_invoices(id, invoice_number, invoice_date, dealer_name, position), registration_items(invoice_id, product_name, category, qty_used, care_plus, review_status, care_start, care_expiry, products(care_plus_years))")
    .eq("wrn", wrn)
    .maybeSingle()
  if (!reg || (!preview && reg.status !== "active") || (preview && ["rejected", "not_applicable"].includes(reg.status))) return new Response("Not found", { status: 404 })

  const [staff, customer] = await Promise.all([getStaff(), getCustomer()])
  if (preview ? !staff : !staff && customer?.id !== reg.customer_id) return new Response("Not found", { status: 404 })

  type Item = { invoice_id: string; product_name: string; category: string; qty_used: number; care_plus: boolean; review_status: string; care_start: string | null; care_expiry: string | null; products: { care_plus_years: number | null } }
  const invoices = [...(reg.registration_invoices as { id: string; invoice_number: string; invoice_date: string; dealer_name: string; position: number }[])].sort((a, b) => a.position - b.position)
  const invoiceDate = new Map(invoices.map((i) => [i.id, i.invoice_date]))
  // Only products approved in the per-product review go on the certificate.
  const items = (reg.registration_items as unknown as Item[])
    .filter((i) => i.care_plus && i.review_status !== "rejected" && (preview || i.review_status === "approved"))
    .map((i) => {
      const years = i.products?.care_plus_years ?? null
      // Before activation the dates aren't stored yet; show what they will be (invoice date + tenure).
      const start = i.care_start ?? invoiceDate.get(i.invoice_id) ?? null
      const expiry = i.care_expiry ?? (start && years ? shiftDate(`${Number(start.slice(0, 4)) + years}${start.slice(4)}`, -1) : null)
      return { ...i, years, care_start: start, care_expiry: expiry }
    })

  const pdf = await renderCarePlusCertificate({
    wrn: reg.wrn,
    owner_name: reg.owner_name,
    owner_mobile: reg.owner_mobile,
    site: `${reg.site_address}, ${reg.city}, ${reg.district}, ${reg.state} — ${reg.pincode}`,
    activated_at: reg.activated_at ?? (preview ? todayIST() : null),
    invoices,
    items,
    preview: preview && reg.status !== "active",
  })
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="SylvanCare-${ref}${preview ? "-preview" : ""}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  })
}
