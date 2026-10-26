import { getCustomer, getStaff } from "@/lib/auth"
import { renderEWarrantyCertificate } from "@/lib/certificates"
import { toSlug } from "@/lib/domain/numbers"
import { supabaseAdmin } from "@/lib/supabase/admin"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Not found", { status: 404 })
  const { data: ew } = await supabaseAdmin()
    .from("e_warranties")
    .select("*, e_warranty_items(*), warranty_programs(certificate_title), registrations(customer_id), issuer:issued_by(full_name)")
    .eq("id", id)
    .maybeSingle()
  if (!ew || ew.status !== "issued") return new Response("Not found", { status: 404 })

  const [staff, customer] = await Promise.all([getStaff(), getCustomer()])
  const ownerId = (ew.registrations as unknown as { customer_id: string }).customer_id
  if (!staff && customer?.id !== ownerId) return new Response("Not found", { status: 404 })

  const pdf = await renderEWarrantyCertificate({
    number: ew.number!,
    program: ew.program,
    title: (ew.warranty_programs as unknown as { certificate_title: string }).certificate_title,
    issued_at: ew.issued_at!,
    customer_name: ew.customer_name,
    customer_address: ew.customer_address,
    dealer_name: ew.dealer_name,
    invoice_number: ew.invoice_number,
    invoice_date: ew.invoice_date,
    issued_by: (ew.issuer as unknown as { full_name: string } | null)?.full_name ?? null,
    items: ew.e_warranty_items,
  })
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Sylvan-eWarranty-${toSlug(ew.number!)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  })
}
