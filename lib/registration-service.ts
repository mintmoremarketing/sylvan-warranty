import { categoryLabel } from "@/lib/domain/constants"
import { todayIST } from "@/lib/domain/dates"
import { toSlug } from "@/lib/domain/numbers"
import {
  validateRegistration,
  type FieldErrors,
  type LineEligibility,
  type ProductRef,
  type RegistrationInput,
} from "@/lib/domain/registration"
import { addWorkingHours } from "@/lib/domain/sla"
import { notify } from "@/lib/notify"
import { lookupPincode } from "@/lib/pincode"
import { getProducts, getSettings } from "@/lib/settings"
import { cleanFiles, verifyUploads } from "@/lib/storage"
import { supabaseAdmin } from "@/lib/supabase/admin"

const str = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "")
const digits = (v: unknown, max = 15) => str(v, 30).replace(/\D/g, "").slice(0, max)
const list = (v: unknown, max: number) => (Array.isArray(v) ? v.slice(0, max) : [])

/** The input comes from the browser, so coerce every field before trusting its shape. */
export function normalizeRegistration(raw: unknown): RegistrationInput {
  const r = (raw ?? {}) as Record<string, unknown>
  const decl = (r.declarations ?? {}) as Record<string, unknown>
  return {
    owner_name: str(r.owner_name, 80),
    owner_email: str(r.owner_email, 120).toLowerCase(),
    owner_mobile: digits(r.owner_mobile, 10),
    site_address: str(r.site_address, 300),
    city: str(r.city, 60),
    district: str(r.district, 60),
    state: str(r.state, 60),
    pincode: digits(r.pincode, 6),
    property_type: str(r.property_type, 40),
    installation_status: str(r.installation_status, 40),
    application_areas: list(r.application_areas, 12).map((a) => str(a, 40)).filter(Boolean),
    carpenter_name: str(r.carpenter_name, 80),
    carpenter_mobile: digits(r.carpenter_mobile, 10),
    referred_by: str(r.referred_by, 40),
    referrer_name: str(r.referrer_name, 80),
    referrer_mobile: digits(r.referrer_mobile, 10),
    referrer_email: str(r.referrer_email, 120).toLowerCase(),
    invoices: list(r.invoices, 10).map((x) => {
      const i = (x ?? {}) as Record<string, unknown>
      return {
        files: cleanFiles(i.files, 10),
        invoice_number: str(i.invoice_number, 40),
        invoice_date: str(i.invoice_date, 10),
        dealer_id: str(i.dealer_id, 40),
        dealer_name: str(i.dealer_name, 120),
        dealer_phone: digits(i.dealer_phone, 11),
        dealer_gstin: str(i.dealer_gstin, 15).toUpperCase(),
        batch_code: str(i.batch_code, 40),
        items: list(i.items, 30).map((y) => {
          const it = (y ?? {}) as Record<string, unknown>
          return { product_id: str(it.product_id, 40), qty_purchased: digits(it.qty_purchased, 6), qty_used: digits(it.qty_used, 6) }
        }),
      }
    }),
    site_photos: cleanFiles(r.site_photos, 10),
    declarations: { genuine: decl.genuine === true, policy: decl.policy === true, contact: decl.contact === true },
  }
}

export type PreparedRegistration =
  | { ok: true; input: RegistrationInput; lines: LineEligibility[][]; products: Map<string, ProductRef> }
  | { ok: false; message: string; errors?: FieldErrors }

/** Validates a submission the same way the form does, then checks what the browser can't. */
export async function prepareRegistration(raw: unknown, uploaderId: string): Promise<PreparedRegistration> {
  const input = normalizeRegistration(raw)
  const [settings, productList] = await Promise.all([getSettings(), getProducts()])
  const products = new Map(productList.map((p) => [p.id, p as ProductRef]))
  const { errors, lines } = validateRegistration(input, { products, settings: settings.eligibility, today: todayIST() })

  // Dealer picked from the list must exist; its name and GSTIN come from the master, not the browser.
  const dealerIds = [...new Set(input.invoices.map((i) => i.dealer_id).filter(Boolean))]
  if (dealerIds.length) {
    const { data: dealers } = await supabaseAdmin().from("dealers").select("id, name, gstin").in("id", dealerIds).eq("active", true)
    const byId = new Map((dealers ?? []).map((d) => [d.id, d]))
    input.invoices.forEach((inv, i) => {
      if (!inv.dealer_id) return
      const d = byId.get(inv.dealer_id)
      if (!d) errors[`invoices.${i}.dealer_name`] = "Select a dealer from the list"
      else {
        inv.dealer_name = d.name
        inv.dealer_gstin = d.gstin ?? ""
      }
    })
  }

  const files = [...input.invoices.flatMap((i) => i.files), ...input.site_photos]
  if (!(await verifyUploads(uploaderId, files))) {
    input.invoices.forEach((_, i) => (errors[`invoices.${i}.files`] = "Please re-upload this invoice"))
  }

  if (!errors.pincode) {
    try {
      const info = await lookupPincode(input.pincode)
      if (!info) errors.pincode = "We couldn't find this pincode"
      else if (!info.districts.includes(input.district)) errors.district = "Select a district for this pincode"
      else input.state = info.state
    } catch (e) {
      // India Post is flaky; don't block registrations on it. Verifiers see the address anyway.
      console.warn("pincode verification skipped", e)
    }
  }

  if (Object.keys(errors).length) return { ok: false, message: "Please fix the highlighted fields.", errors }
  return { ok: true, input, lines: lines as LineEligibility[][], products }
}

/** Finds (or creates) the customer record for an email, used for assisted registrations. */
export async function customerForEmail(email: string, name: string, mobile: string) {
  const db = supabaseAdmin()
  const { data: existing } = await db.from("customers").select("id, full_name, mobile").eq("email", email).maybeSingle()
  if (existing) return existing.id as string
  const { data, error } = await db.from("customers").insert({ email, full_name: name, mobile }).select("id").single()
  if (error) throw new Error(`customer insert failed: ${error.message}`)
  return data.id as string
}

type CreateArgs = {
  prepared: Extract<PreparedRegistration, { ok: true }>
  customerId: string
  channel: "self" | "customer_care" | "sales" | "dealer"
  staffId?: string
  actorLabel: string
  consentMethod: "email_otp_login" | "email_otp_assisted"
  ip: string | null
  userAgent: string | null
}

export async function createRegistration({ prepared, customerId, channel, staffId, actorLabel, consentMethod, ip, userAgent }: CreateArgs) {
  const { input, lines, products } = prepared
  const settings = await getSettings()
  const carePlus = lines.some((inv) => inv.some((l) => l.carePlus))
  const slaDue = carePlus ? addWorkingHours(new Date(), settings.sla.registration_hours, settings.workingHours, settings.holidays) : null

  const payload = {
    customer_id: customerId,
    channel,
    created_by_staff: staffId ?? "",
    uploaded_by_customer: staffId ? "" : customerId,
    actor_label: actorLabel,
    owner_name: input.owner_name,
    owner_email: input.owner_email,
    owner_mobile: input.owner_mobile,
    site_address: input.site_address,
    city: input.city,
    district: input.district,
    state: input.state,
    pincode: input.pincode,
    property_type: input.property_type,
    installation_status: input.installation_status,
    application_areas: input.application_areas,
    carpenter_name: input.carpenter_name,
    carpenter_mobile: input.carpenter_mobile,
    referred_by: input.referred_by,
    referrer_name: input.referrer_name,
    referrer_mobile: input.referrer_mobile,
    referrer_email: input.referrer_email,
    care_plus: carePlus,
    status: carePlus ? "received" : "not_applicable",
    sla_due_at: slaDue?.toISOString() ?? "",
    invoices: input.invoices.map((inv, i) => ({
      ...inv,
      items: inv.items.map((it, j) => {
        const p = products.get(it.product_id)!
        return {
          product_id: p.id,
          product_name: p.name,
          category: p.category,
          qty_purchased: Number(it.qty_purchased),
          qty_used: Number(it.qty_used),
          care_plus: lines[i][j].carePlus,
          standard: lines[i][j].standard,
          standard_program: p.standard_program,
          warranty_period: p.standard_period,
        }
      }),
    })),
    site_photos: input.site_photos,
    consent: {
      policy_version: `${settings.policyVersions.care_plus}; ${settings.policyVersions.standard}`,
      statements: ["genuine", "policy", "contact"],
      method: consentMethod,
      assisted_by: staffId ?? "",
      ip,
      user_agent: userAgent,
    },
  }

  const db = supabaseAdmin()
  const { data: wrn, error } = await db.rpc("submit_registration", { p: payload })
  if (error || typeof wrn !== "string") {
    console.error("submit_registration", error)
    throw new Error("We couldn't save your registration. Please try again.")
  }

  const { data: reg } = await db.from("registrations").select("id").eq("wrn", wrn).single()
  const { count: eWarranties } = await db.from("e_warranties").select("id", { count: "exact", head: true }).eq("registration_id", reg!.id)

  // Fill in the customer's profile the first time.
  await db.from("customers").update({ full_name: input.owner_name, mobile: input.owner_mobile }).eq("id", customerId).is("full_name", null)

  await runFraudChecks(reg!.id).catch((e) => console.error("fraud checks", e))

  const carePlusItems = payload.invoices.flatMap((inv) => inv.items.filter((i) => i.care_plus))
  const standardItems = payload.invoices.flatMap((inv) => inv.items.filter((i) => i.standard))
  const summary = [
    carePlusItems.length
      ? `SylvanCare+ requested for: ${carePlusItems.map((i) => `${i.product_name} (${i.qty_used} sheets)`).join(", ")}.`
      : "",
    standardItems.length
      ? `Standard e-warranty requested for: ${standardItems.map((i) => `${i.product_name} ${categoryLabel(i.category).toLowerCase()}`).join(", ")}.`
      : "",
  ]
    .filter(Boolean)
    .join(" ")

  await notify("registration_received", input.owner_email, { name: input.owner_name, wrn, slug: toSlug(wrn), summary }, { registration_id: reg!.id })

  return { wrn, id: reg!.id as string, carePlus, eWarranties: eWarranties ?? 0 }
}

/** Duplicate and consistency checks from the brief. They raise flags for verifiers; they don't reject. */
export async function runFraudChecks(registrationId: string) {
  const db = supabaseAdmin()
  const { data: reg } = await db
    .from("registrations")
    .select("id, wrn, customer_id, owner_mobile, site_address, pincode, registration_invoices(id, invoice_number, invoice_number_norm, dealer_id, dealer_name)")
    .eq("id", registrationId)
    .single()
  if (!reg) return
  const flags: { registration_id: string; code: string; severity: string; detail: string; related_wrn?: string }[] = []
  const invoices = reg.registration_invoices as { id: string; invoice_number: string; invoice_number_norm: string; dealer_id: string | null; dealer_name: string }[]

  for (const inv of invoices) {
    const { data: dupes } = await db
      .from("registration_invoices")
      .select("registration_id, registrations!inner(wrn)")
      .eq("invoice_number_norm", inv.invoice_number_norm)
      .neq("registration_id", reg.id)
      .limit(5)
    for (const d of dupes ?? []) {
      const wrn = (d.registrations as unknown as { wrn: string }).wrn
      flags.push({ registration_id: reg.id, code: "duplicate_invoice", severity: "high", detail: `Invoice ${inv.invoice_number} is also registered under ${wrn}`, related_wrn: wrn })
    }
    if (!inv.dealer_id)
      flags.push({ registration_id: reg.id, code: "unlisted_dealer", severity: "warning", detail: `Dealer "${inv.dealer_name}" isn't on the authorised dealer list` })
  }

  const { data: docs } = await db.from("documents").select("sha256").eq("registration_id", reg.id).eq("kind", "invoice").not("sha256", "is", null)
  const hashes = [...new Set((docs ?? []).map((d) => d.sha256 as string))]
  if (hashes.length) {
    const { data: same } = await db
      .from("documents")
      .select("registration_id, registrations!inner(wrn)")
      .in("sha256", hashes)
      .neq("registration_id", reg.id)
      .limit(5)
    for (const d of same ?? []) {
      const wrn = (d.registrations as unknown as { wrn: string }).wrn
      flags.push({ registration_id: reg.id, code: "duplicate_invoice_file", severity: "high", detail: `The same invoice file was uploaded for ${wrn}`, related_wrn: wrn })
    }
  }

  const { count: mobileCount } = await db
    .from("registrations")
    .select("id", { count: "exact", head: true })
    .eq("owner_mobile", reg.owner_mobile)
    .neq("id", reg.id)
  if (mobileCount)
    flags.push({ registration_id: reg.id, code: "repeat_mobile", severity: "info", detail: `This mobile number is on ${mobileCount} other registration${mobileCount > 1 ? "s" : ""}` })

  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "")
  const { data: samePin } = await db
    .from("registrations")
    .select("wrn, site_address, customer_id")
    .eq("pincode", reg.pincode)
    .neq("id", reg.id)
    .neq("customer_id", reg.customer_id)
    .limit(200)
  for (const other of samePin ?? []) {
    if (norm(other.site_address) === norm(reg.site_address))
      flags.push({ registration_id: reg.id, code: "site_reused", severity: "warning", detail: `The same site address is registered by another customer under ${other.wrn}`, related_wrn: other.wrn })
  }

  // De-duplicate identical flags before saving.
  const unique = [...new Map(flags.map((f) => [`${f.code}|${f.detail}`, f])).values()]
  if (unique.length) await db.from("fraud_flags").insert(unique)
}
