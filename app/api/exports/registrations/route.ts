import { getStaff, hasRole } from "@/lib/auth"
import { ITEM_REVIEW, REGISTRATION_STATUS, type ItemReview, type RegistrationStatus } from "@/lib/domain/constants"
import { supabaseAdmin } from "@/lib/supabase/admin"

const csv = (v: unknown) => {
  const s = v == null ? "" : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}

type Item = { id: string; product_id: string; review_status: ItemReview; product_name: string; category: string; qty_purchased: number; qty_used: number; care_plus: boolean; standard: boolean; care_start: string | null; care_expiry: string | null; invoice_id: string }
type Invoice = { id: string; invoice_number: string; invoice_date: string; dealer_name: string; dealer_phone: string | null; batch_code: string | null }
type EW = { program: string; number: string | null; status: string; issued_at: string | null; issuer: { full_name: string } | null; e_warranty_items: { item_id: string | null; product_id: string }[] }

/** Month-wise download of everything captured (brief: "all info ... downloadable monthwise"). */
export async function GET(req: Request) {
  const staff = await getStaff()
  if (!staff || !hasRole(staff, ["management", "approver", "finance", "sales_coordinator"])) return new Response("Not found", { status: 404 })

  const month = new URL(req.url).searchParams.get("month") ?? ""
  if (!/^\d{4}-\d{2}$/.test(month)) return new Response("Use ?month=YYYY-MM", { status: 400 })
  const [y, m] = month.split("-").map(Number)
  // Month boundaries in India time.
  const from = new Date(Date.UTC(y, m - 1, 1) - 330 * 60_000).toISOString()
  const to = new Date(Date.UTC(y, m, 1) - 330 * 60_000).toISOString()

  const { data } = await supabaseAdmin()
    .from("registrations")
    .select(
      "wrn, submitted_at, channel, status, care_plus, owner_name, owner_email, owner_mobile, site_address, city, district, state, pincode, property_type, installation_status, application_areas, carpenter_name, carpenter_mobile, referred_by, referrer_name, referrer_mobile, referrer_email, activated_at, registration_invoices(id, invoice_number, invoice_date, dealer_name, dealer_phone, batch_code), registration_items(id, product_id, product_name, category, qty_purchased, qty_used, review_status, care_plus, standard, care_start, care_expiry, invoice_id), e_warranties(program, number, status, issued_at, issuer:issued_by(full_name), e_warranty_items(item_id, product_id)), claims(claim_no, status)"
    )
    .gte("submitted_at", from)
    .lt("submitted_at", to)
    .order("submitted_at")

  const header = [
    "WRN", "Submitted (IST)", "Channel", "SylvanCare+ status", "Owner", "Email", "Mobile", "Site address", "City", "District", "State", "Pincode",
    "Property type", "Installation status", "Used in", "Carpenter", "Carpenter mobile", "Referred by", "Referrer", "Referrer mobile", "Referrer email",
    "Invoice no", "Invoice date", "Dealer", "Dealer phone", "Batch code", "Product", "Category", "Qty purchased", "Qty used at site",
    "Product check", "SylvanCare+", "SylvanCare+ start", "SylvanCare+ expiry", "Standard e-warranty", "E-warranty no", "E-warranty status", "E-warranty issued", "Issued by", "Claim", "Claim status",
  ]
  const lines = [header.map(csv).join(",")]
  const ist = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "")

  for (const r of data ?? []) {
    const invoices = new Map((r.registration_invoices as Invoice[]).map((i) => [i.id, i]))
    const ews = r.e_warranties as unknown as EW[]
    const claim = (Array.isArray(r.claims) ? r.claims[0] : r.claims) as { claim_no: string; status: string } | null
    for (const it of r.registration_items as Item[]) {
      const inv = invoices.get(it.invoice_id)
      const ew = ews.find((e) => e.e_warranty_items.some((x) => (x.item_id ? x.item_id === it.id : x.product_id === it.product_id)))
      lines.push(
        [
          r.wrn, ist(r.submitted_at), r.channel, r.care_plus ? REGISTRATION_STATUS[r.status as RegistrationStatus]?.staff : "Standard only",
          r.owner_name, r.owner_email, r.owner_mobile, r.site_address, r.city, r.district, r.state, r.pincode,
          r.property_type, r.installation_status, (r.application_areas as string[]).join("; "), r.carpenter_name, r.carpenter_mobile,
          r.referred_by, r.referrer_name, r.referrer_mobile, r.referrer_email,
          inv?.invoice_number, inv?.invoice_date, inv?.dealer_name, inv?.dealer_phone, inv?.batch_code,
          it.product_name, it.category, it.qty_purchased, it.qty_used,
          ITEM_REVIEW[it.review_status], it.care_plus ? "Yes" : "No", it.care_start, it.care_expiry,
          it.standard ? "Yes" : "No", ew?.number, ew?.status, ist(ew?.issued_at ?? null), ew?.issuer?.full_name,
          it.care_plus ? claim?.claim_no : "", it.care_plus ? claim?.status : "",
        ]
          .map(csv)
          .join(",")
      )
    }
  }

  // BOM so Excel reads the UTF-8 correctly.
  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sylvan-warranty-registrations-${month}.csv"`,
      "Cache-Control": "private, no-store",
    },
  })
}
