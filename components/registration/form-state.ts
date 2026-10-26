import { doneFiles, type UploadItem } from "@/components/file-uploader"
import type { FieldErrors, RegistrationInput } from "@/lib/domain/registration"

export type DealerOption = { id: string; name: string; city: string | null; gstin: string | null }

export type ItemDraft = { id: string; category: string; product_id: string; qty_purchased: string; qty_used: string }

export type InvoiceDraft = {
  id: string
  files: UploadItem[]
  invoice_number: string
  invoice_date: string
  dealer: DealerOption | null
  dealer_manual: boolean
  dealer_name: string
  dealer_phone: string
  dealer_gstin: string
  batch_code: string
  items: ItemDraft[]
}

export type RegistrationDraft = Omit<RegistrationInput, "invoices" | "site_photos"> & {
  districts: string[]
  invoices: InvoiceDraft[]
  site_photos: UploadItem[]
}

/** What the submit action returns; assisted registrations need the customer's consent code first. */
export type SubmitResult =
  | { ok: true; kind: "registered"; wrn: string; slug: string; carePlus: boolean; eWarranties: number }
  | { ok: true; kind: "consent_required"; otpId: string; email: string }
  | { ok: false; message: string; errors?: FieldErrors }

const uid = () => crypto.randomUUID()

// The first invoice and item are server-rendered, so they need stable ids to hydrate cleanly.
export const newItem = (id = uid()): ItemDraft => ({ id, category: "", product_id: "", qty_purchased: "", qty_used: "" })

export const newInvoice = (id = uid(), firstItemId?: string): InvoiceDraft => ({
  id,
  files: [],
  invoice_number: "",
  invoice_date: "",
  dealer: null,
  dealer_manual: false,
  dealer_name: "",
  dealer_phone: "",
  dealer_gstin: "",
  batch_code: "",
  items: [newItem(firstItemId)],
})

export function initialDraft(defaults: { email: string; name?: string | null; mobile?: string | null }): RegistrationDraft {
  return {
    owner_name: defaults.name ?? "",
    owner_email: defaults.email,
    owner_mobile: defaults.mobile ?? "",
    site_address: "",
    city: "",
    district: "",
    state: "",
    pincode: "",
    districts: [],
    property_type: "",
    installation_status: "",
    application_areas: [],
    carpenter_name: "",
    carpenter_mobile: "",
    referred_by: "",
    referrer_name: "",
    referrer_mobile: "",
    referrer_email: "",
    invoices: [newInvoice("invoice-1", "item-1")],
    site_photos: [],
    declarations: { genuine: false, policy: false, contact: false },
  }
}

export function toInput(d: RegistrationDraft): RegistrationInput {
  return {
    owner_name: d.owner_name,
    owner_email: d.owner_email,
    owner_mobile: d.owner_mobile,
    site_address: d.site_address,
    city: d.city,
    district: d.district,
    state: d.state,
    pincode: d.pincode,
    property_type: d.property_type,
    installation_status: d.installation_status,
    application_areas: d.application_areas,
    carpenter_name: d.carpenter_name,
    carpenter_mobile: d.carpenter_mobile,
    referred_by: d.referred_by,
    referrer_name: d.referrer_name,
    referrer_mobile: d.referrer_mobile,
    referrer_email: d.referrer_email,
    invoices: d.invoices.map((inv) => ({
      files: doneFiles(inv.files),
      invoice_number: inv.invoice_number,
      invoice_date: inv.invoice_date,
      dealer_id: inv.dealer_manual ? "" : (inv.dealer?.id ?? ""),
      dealer_name: inv.dealer_manual ? inv.dealer_name : (inv.dealer?.name ?? ""),
      dealer_phone: inv.dealer_manual ? inv.dealer_phone : "",
      dealer_gstin: inv.dealer_manual ? inv.dealer_gstin.toUpperCase() : (inv.dealer?.gstin ?? ""),
      batch_code: inv.batch_code,
      items: inv.items.map(({ product_id, qty_purchased, qty_used }) => ({ product_id, qty_purchased, qty_used })),
    })),
    site_photos: doneFiles(d.site_photos),
    declarations: d.declarations,
  }
}
