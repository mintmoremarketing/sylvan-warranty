import { getCustomer, getStaff } from "@/lib/auth"
import { renderEWarrantyCertificate, type EWarrantyData } from "@/lib/certificates"
import { toSlug } from "@/lib/domain/numbers"
import { supabaseAdmin } from "@/lib/supabase/admin"

/** The standard e-warranty. `?preview=1` lets staff see it before it is issued, marked as a preview. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const preview = new URL(req.url).searchParams.get("preview") === "1"
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Not found", { status: 404 })
  const db = supabaseAdmin()
  const { data: ew } = await db
    .from("e_warranties")
    .select("*, e_warranty_items(*, registration_items(review_status)), registrations(customer_id), issuer:issued_by(full_name)")
    .eq("id", id)
    .maybeSingle()
  if (!ew || (!preview && ew.status !== "issued") || (preview && ew.status === "rejected")) return new Response("Not found", { status: 404 })

  const [staff, customer] = await Promise.all([getStaff(), getCustomer()])
  const ownerId = (ew.registrations as unknown as { customer_id: string }).customer_id
  if (preview ? !staff : !staff && customer?.id !== ownerId) return new Response("Not found", { status: 404 })

  type Line = EWarrantyData["items"][number] & { program: string | null; registration_items: { review_status: string } | null }
  // Only products approved in the per-product review go on the certificate (lines without a link predate it).
  const items = (ew.e_warranty_items as Line[]).filter((i) => {
    const review = i.registration_items?.review_status ?? "approved"
    return review !== "rejected" && (preview || review === "approved")
  })
  const codes = [...new Set(items.map((i) => i.program ?? ew.program))]
  const { data: programs } = await db.from("warranty_programs").select("code, certificate_title, sort").in("code", codes.length ? codes : [ew.program]).order("sort")
  const draft = preview && ew.status !== "issued"

  const pdf = await renderEWarrantyCertificate({
    number: draft ? "PREVIEW" : ew.number!,
    programs: (programs ?? []).map((p) => ({ code: p.code, title: p.certificate_title })),
    issued_at: ew.issued_at ?? new Date().toISOString(),
    customer_name: ew.customer_name,
    customer_address: ew.customer_address,
    dealer_name: ew.dealer_name,
    invoice_number: ew.invoice_number,
    invoice_date: ew.invoice_date,
    issued_by: (ew.issuer as unknown as { full_name: string } | null)?.full_name ?? (draft ? (staff?.full_name ?? null) : null),
    items,
    preview: draft,
  })
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Sylvan-eWarranty-${draft ? "preview" : toSlug(ew.number!)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  })
}
