import { daysBetween, shiftDate } from "@/lib/domain/dates"

// ---------------------------------------------------------------------------
// Shared rules
// ---------------------------------------------------------------------------

export const MOBILE_RE = /^[6-9]\d{9}$/
export const PHONE_RE = /^\d{10,11}$/
export const PINCODE_RE = /^[1-9]\d{5}$/
export const GSTIN_RE = /^[0-9]{2}[A-Z0-9]{10}[0-9A-Z]{3}$/
export const NAME_RE = /^[\p{L}][\p{L} .'-]{1,79}$/u
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const INVOICE_NO_RE = /^[A-Za-z0-9][A-Za-z0-9/_.\- ]{0,39}$/

export const MAX_INVOICES = 5
export const MAX_FILES = 10
export const MAX_ITEMS_PER_INVOICE = 20

export const DOCUMENT_BUCKET = "documents"

/** Upload rules per kind of file. */
export const UPLOAD_KINDS = {
  invoice: { label: "Invoice", accept: ".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif", maxBytes: 20 * 1024 * 1024, video: false },
  site_photo: { label: "Site photo", accept: ".jpg,.jpeg,.png,.webp,.heic,.heif", maxBytes: 20 * 1024 * 1024, video: false },
  info_response: { label: "Document", accept: ".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif", maxBytes: 20 * 1024 * 1024, video: false },
  claim_photo: { label: "Photo", accept: ".jpg,.jpeg,.png,.webp,.heic,.heif", maxBytes: 20 * 1024 * 1024, video: false },
  claim_video: { label: "Video", accept: ".mp4,.mov,.webm", maxBytes: 100 * 1024 * 1024, video: true },
  inspection_photo: { label: "Photo", accept: ".jpg,.jpeg,.png,.webp,.heic,.heif", maxBytes: 20 * 1024 * 1024, video: false },
  inspection_video: { label: "Video", accept: ".mp4,.mov,.webm", maxBytes: 100 * 1024 * 1024, video: true },
  lab_report: { label: "Lab report", accept: ".pdf,.jpg,.jpeg,.png", maxBytes: 20 * 1024 * 1024, video: false },
  settlement_photo: { label: "Photo", accept: ".jpg,.jpeg,.png,.webp,.heic,.heif", maxBytes: 20 * 1024 * 1024, video: false },
  decision_evidence: { label: "Supporting document", accept: ".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif", maxBytes: 20 * 1024 * 1024, video: false },
} as const
export type UploadKind = keyof typeof UPLOAD_KINDS

const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
}

/** Content type from the extension, so HEIC works on browsers that report an empty type. */
export function contentTypeFor(name: string, kind: UploadKind) {
  const ext = name.split(".").pop()?.toLowerCase() ?? ""
  if (!UPLOAD_KINDS[kind].accept.split(",").includes(`.${ext}`)) return null
  return CONTENT_TYPES[ext] ?? null
}

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------

export type ProductRef = {
  id: string
  name: string
  category: string
  standard_program: string | null
  standard_period: string | null
  care_plus_years: number | null
  coverage_note: string | null
}

export type EligibilitySettings = {
  carePlus: { manufacturedFrom: string; windowDays: number; manufactureCheck: "invoice_date" | "batch_code" }
  standard: { windowDays: number }
}

export type LineEligibility = {
  carePlus: boolean
  standard: boolean
  carePlusNote: string | null
  standardNote: string | null
}

/** Which programs one product line qualifies for, given its invoice date. */
export function lineEligibility(
  product: ProductRef,
  invoiceDate: string,
  today: string,
  s: EligibilitySettings
): LineEligibility {
  const age = daysBetween(invoiceDate, today)

  let carePlusNote: string | null = null
  const isCarePlusProduct = product.care_plus_years != null && product.category === "plywood"
  if (!isCarePlusProduct) carePlusNote = null
  else if (age > s.carePlus.windowDays)
    carePlusNote = `SylvanCare+ registration window (${s.carePlus.windowDays} days) has passed`
  else if (s.carePlus.manufactureCheck === "invoice_date" && invoiceDate < s.carePlus.manufacturedFrom)
    carePlusNote = "SylvanCare+ covers purchases from 1 Oct 2026"
  const carePlus = isCarePlusProduct && carePlusNote === null

  let standardNote: string | null = null
  if (!product.standard_program) standardNote = "No standard e-warranty for this product"
  else if (age > s.standard.windowDays)
    standardNote = `Standard e-warranty window (${s.standard.windowDays} days) has passed`
  const standard = !!product.standard_program && standardNote === null

  return { carePlus, standard, carePlusNote, standardNote }
}

// ---------------------------------------------------------------------------
// Registration input
// ---------------------------------------------------------------------------

export type FileRef = {
  path: string
  file_name: string
  content_type: string
  size_bytes: number
  sha256: string | null
}

export type ItemInput = { product_id: string; qty_purchased: string; qty_used: string }

export type InvoiceInput = {
  files: FileRef[]
  invoice_number: string
  invoice_date: string
  dealer_id: string
  dealer_name: string
  dealer_phone: string
  dealer_gstin: string
  batch_code: string
  items: ItemInput[]
}

export type RegistrationInput = {
  owner_name: string
  owner_email: string
  owner_mobile: string
  site_address: string
  city: string
  district: string
  state: string
  pincode: string
  property_type: string
  installation_status: string
  application_areas: string[]
  carpenter_name: string
  carpenter_mobile: string
  referred_by: string
  referrer_name: string
  referrer_mobile: string
  referrer_email: string
  invoices: InvoiceInput[]
  site_photos: FileRef[]
  declarations: { genuine: boolean; policy: boolean; contact: boolean }
}

export const DECLARATIONS = {
  genuine:
    "I declare that the details and invoice submitted are genuine, the products listed were purchased from an authorised Sylvan dealer, and they are used at the site above. The warranty is issued in the name of the home / site owner.",
  policy:
    "I have read and accept the SylvanCare+ Warranty Policy and the Sylvan standard warranty terms & conditions, including site inspection and verification by Sylvan's authorised representatives.",
  contact:
    "I consent to Sylvan Plyboard (India) Ltd. processing these details and contacting me by email, phone, SMS or WhatsApp about this warranty.",
} as const

export type FieldErrors = Record<string, string>

export type ValidationContext = {
  products: Map<string, ProductRef>
  settings: EligibilitySettings
  today: string
}

export type ValidationResult = {
  errors: FieldErrors
  /** Eligibility per invoice per item, for the form's badges and for the server. */
  lines: (LineEligibility | null)[][]
}

export function validateRegistration(p: RegistrationInput, ctx: ValidationContext): ValidationResult {
  const e: FieldErrors = {}
  const req = (key: string, value: string, label: string) => {
    if (!value.trim()) e[key] = `${label} is required`
    return !!value.trim()
  }

  if (req("owner_name", p.owner_name, "Owner name") && !NAME_RE.test(p.owner_name.trim()))
    e.owner_name = "Enter a valid name (letters only)"
  if (req("owner_email", p.owner_email, "Email") && !EMAIL_RE.test(p.owner_email.trim()))
    e.owner_email = "Enter a valid email address"
  if (req("owner_mobile", p.owner_mobile, "Mobile number") && !MOBILE_RE.test(p.owner_mobile))
    e.owner_mobile = "Enter a valid 10-digit mobile number"
  if (req("site_address", p.site_address, "Site address") && p.site_address.trim().length < 10)
    e.site_address = "Enter the full site address"
  req("city", p.city, "City / town")
  if (req("pincode", p.pincode, "Pincode") && !PINCODE_RE.test(p.pincode))
    e.pincode = "Enter a valid 6-digit pincode"
  else if (!e.pincode && !p.state) e.pincode = "We couldn't find this pincode"
  if (!e.pincode && !p.district) e.district = "Select a district"

  req("property_type", p.property_type, "Property type")
  req("installation_status", p.installation_status, "Installation status")
  if (p.application_areas.length === 0) e.application_areas = "Select where the products are used"
  if (p.carpenter_name.trim() && !NAME_RE.test(p.carpenter_name.trim())) e.carpenter_name = "Enter a valid name"
  if (p.carpenter_mobile && !MOBILE_RE.test(p.carpenter_mobile)) e.carpenter_mobile = "Enter a valid 10-digit mobile number"

  if (p.referred_by) {
    if (req("referrer_name", p.referrer_name, "Referrer name") && !NAME_RE.test(p.referrer_name.trim()))
      e.referrer_name = "Enter a valid name"
  }
  if (p.referrer_mobile && !MOBILE_RE.test(p.referrer_mobile)) e.referrer_mobile = "Enter a valid 10-digit mobile number"
  if (p.referrer_email.trim() && !EMAIL_RE.test(p.referrer_email.trim())) e.referrer_email = "Enter a valid email address"

  const lines: (LineEligibility | null)[][] = []
  const { today, settings } = ctx
  const oldest = shiftDate(today, -settings.carePlus.windowDays)
  const seenInvoices = new Map<string, number>()

  if (p.invoices.length === 0) e.invoices = "Add at least one invoice"
  if (p.invoices.length > MAX_INVOICES) e.invoices = `Up to ${MAX_INVOICES} invoices per registration`

  p.invoices.forEach((inv, i) => {
    const k = (f: string) => `invoices.${i}.${f}`
    if (inv.files.length === 0) e[k("files")] = "Upload the invoice"
    else if (inv.files.length > MAX_FILES) e[k("files")] = `Up to ${MAX_FILES} files per invoice`

    if (req(k("invoice_number"), inv.invoice_number, "Invoice number")) {
      const norm = inv.invoice_number.replace(/[^A-Za-z0-9]/g, "").toUpperCase()
      if (!INVOICE_NO_RE.test(inv.invoice_number.trim())) e[k("invoice_number")] = "Use letters, numbers, / - _ . only"
      else if (seenInvoices.has(norm)) e[k("invoice_number")] = `Same as invoice ${seenInvoices.get(norm)! + 1}`
      else seenInvoices.set(norm, i)
    }

    const dateOk = !!inv.invoice_date && inv.invoice_date <= today && inv.invoice_date >= oldest
    if (!inv.invoice_date) e[k("invoice_date")] = "Invoice date is required"
    else if (inv.invoice_date > today) e[k("invoice_date")] = "Invoice date can't be in the future"
    else if (inv.invoice_date < oldest)
      e[k("invoice_date")] = `Only invoices from the last ${settings.carePlus.windowDays} days can be registered`

    if (req(k("dealer_name"), inv.dealer_name, "Dealer") && !inv.dealer_id) {
      if (req(k("dealer_phone"), inv.dealer_phone, "Dealer phone") && !PHONE_RE.test(inv.dealer_phone))
        e[k("dealer_phone")] = "Enter a valid phone number"
    }
    if (inv.dealer_gstin && !GSTIN_RE.test(inv.dealer_gstin)) e[k("dealer_gstin")] = "Enter a valid 15-character GSTIN"

    const invoiceLines: (LineEligibility | null)[] = []
    if (inv.items.length === 0) e[k("items")] = "Add at least one product"
    if (inv.items.length > MAX_ITEMS_PER_INVOICE) e[k("items")] = `Up to ${MAX_ITEMS_PER_INVOICE} products per invoice`
    const seenProducts = new Set<string>()
    let needsBatch = false

    inv.items.forEach((item, j) => {
      const ik = (f: string) => k(`items.${j}.${f}`)
      const product = ctx.products.get(item.product_id)
      if (!item.product_id) e[ik("product_id")] = "Select a product"
      else if (!product) e[ik("product_id")] = "Select a product from the list"
      else if (seenProducts.has(item.product_id)) e[ik("product_id")] = "Already added — update its quantity instead"
      else seenProducts.add(item.product_id)

      const purchased = Number(item.qty_purchased)
      const used = Number(item.qty_used)
      if (!item.qty_purchased) e[ik("qty_purchased")] = "Required"
      else if (!Number.isInteger(purchased) || purchased < 1 || purchased > 100000) e[ik("qty_purchased")] = "Enter 1 to 100,000"
      if (!item.qty_used) e[ik("qty_used")] = "Required"
      else if (!Number.isInteger(used) || used < 0) e[ik("qty_used")] = "Enter a whole number"
      else if (!e[ik("qty_purchased")] && used > purchased) e[ik("qty_used")] = "Can't be more than purchased"

      const elig = product && dateOk ? lineEligibility(product, inv.invoice_date, today, settings) : null
      invoiceLines.push(elig)
      if (elig && !elig.carePlus && !elig.standard && !e[ik("product_id")])
        e[ik("product_id")] = elig.carePlusNote ?? elig.standardNote ?? "Not eligible for any warranty"
      if (elig?.carePlus) needsBatch = true
    })
    lines.push(invoiceLines)

    if (needsBatch && settings.carePlus.manufactureCheck === "batch_code" && !inv.batch_code.trim())
      e[k("batch_code")] = "Enter the batch / stamp code printed on the sheets"
  })

  if (!p.declarations.genuine) e["declarations.genuine"] = "Please confirm the declaration"
  if (!p.declarations.policy) e["declarations.policy"] = "Please accept the policy to continue"
  if (!p.declarations.contact) e["declarations.contact"] = "Please give consent to continue"

  return { errors: e, lines }
}
