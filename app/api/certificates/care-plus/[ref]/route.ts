import { getCustomer, getStaff } from "@/lib/auth"
import { renderCarePlusCertificate } from "@/lib/certificates"
import { fromSlug } from "@/lib/domain/numbers"
import { supabaseAdmin } from "@/lib/supabase/admin"

export async function GET(_req: Request, { params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params
  const wrn = fromSlug(ref)
  const db = supabaseAdmin()
  const { data: reg } = await db
    .from("registrations")
    .select("id, wrn, customer_id, owner_name, owner_mobile, site_address, city, district, state, pincode, status, activated_at, registration_invoices(invoice_number, invoice_date, dealer_name, position), registration_items(product_name, category, qty_used, care_plus, care_start, care_expiry, products(care_plus_years))")
    .eq("wrn", wrn)
    .maybeSingle()
  if (!reg || reg.status !== "active") return new Response("Not found", { status: 404 })

  const [staff, customer] = await Promise.all([getStaff(), getCustomer()])
  if (!staff && customer?.id !== reg.customer_id) return new Response("Not found", { status: 404 })

  type Item = { product_name: string; category: string; qty_used: number; care_plus: boolean; care_start: string | null; care_expiry: string | null; products: { care_plus_years: number | null } }
  const pdf = await renderCarePlusCertificate({
    wrn: reg.wrn,
    owner_name: reg.owner_name,
    owner_mobile: reg.owner_mobile,
    site: `${reg.site_address}, ${reg.city}, ${reg.district}, ${reg.state} — ${reg.pincode}`,
    activated_at: reg.activated_at,
    invoices: [...(reg.registration_invoices as { invoice_number: string; invoice_date: string; dealer_name: string; position: number }[])].sort((a, b) => a.position - b.position),
    items: (reg.registration_items as unknown as Item[])
      .filter((i) => i.care_plus)
      .map((i) => ({ ...i, years: i.products?.care_plus_years ?? null })),
  })
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="SylvanCare-${ref}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  })
}
