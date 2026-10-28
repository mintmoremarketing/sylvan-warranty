"use client"

import { IconPlus, IconTrash } from "@tabler/icons-react"

import { DatePicker } from "@/components/date-picker"
import { FileUploader, type UploadItem } from "@/components/file-uploader"
import { FormField } from "@/components/form-field"
import { PhoneInput } from "@/components/phone-input"
import { newItem, type InvoiceDraft, type ItemDraft } from "@/components/registration/form-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FieldDescription, FieldError, FieldGroup, FieldLegend, FieldSeparator, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FORM_CATEGORIES, inFormCategory } from "@/lib/domain/constants"
import { shiftDate } from "@/lib/domain/dates"
import {
  lineEligibility,
  MAX_ITEMS_PER_INVOICE,
  type EligibilitySettings,
  type ProductRef,
} from "@/lib/domain/registration"

type Props = {
  invoice: InvoiceDraft
  index: number
  products: ProductRef[]
  settings: EligibilitySettings
  today: string
  error: (key: string) => string | undefined
  canRemove: boolean
  onChange: (update: (inv: InvoiceDraft) => InvoiceDraft) => void
  onRemove: () => void
}

export function InvoiceCard({ invoice, index, products, settings, today, error, canRemove, onChange, onRemove }: Props) {
  const id = (f: string) => `inv-${invoice.id}-${f}`
  const e = (f: string) => error(`invoices.${index}.${f}`)
  const set = <K extends keyof InvoiceDraft>(key: K, value: InvoiceDraft[K]) => onChange((inv) => ({ ...inv, [key]: value }))
  const setItem = (itemId: string, patch: Partial<ItemDraft>) =>
    onChange((inv) => ({ ...inv, items: inv.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)) }))
  const setFiles = (update: (prev: UploadItem[]) => UploadItem[]) => onChange((inv) => ({ ...inv, files: update(inv.files) }))

  const productById = new Map(products.map((p) => [p.id, p]))
  const needsBatch =
    settings.carePlus.manufactureCheck === "batch_code" &&
    invoice.items.some((it) => productById.get(it.product_id)?.care_plus_years)

  return (
    <FieldSet className="border-t pt-6 xs:rounded-xl xs:border xs:bg-card xs:p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <FieldLegend className="mb-0">Invoice {index + 1}</FieldLegend>
        {canRemove && (
          <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
            <IconTrash data-icon="inline-start" />
            Remove
          </Button>
        )}
      </div>

      <FieldGroup>
        <FormField
          label="GST invoice"
          htmlFor={id("files")}
          required
          error={e("files")}
          description="Upload every page. The invoice must show the Sylvan product name and quantity."
        >
          <FileUploader id={id("files")} kind="invoice" items={invoice.files} setItems={setFiles} invalid={!!e("files")} label="Add invoice photo or PDF" />
        </FormField>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Invoice number" htmlFor={id("number")} required error={e("invoice_number")}>
            <Input
              id={id("number")}
              placeholder="e.g. INV/2026/0412"
              value={invoice.invoice_number}
              onChange={(ev) => set("invoice_number", ev.target.value)}
              aria-invalid={!!e("invoice_number")}
              maxLength={40}
            />
          </FormField>
          <FormField
            label="Invoice date"
            htmlFor={id("date")}
            required
            error={e("invoice_date")}
            description={`SylvanCare+: within ${settings.carePlus.windowDays} days · standard e-warranty: within ${settings.standard.windowDays} days`}
          >
            <DatePicker
              id={id("date")}
              value={invoice.invoice_date}
              onValueChange={(v) => set("invoice_date", v)}
              min={shiftDate(today, -settings.carePlus.windowDays)}
              max={today}
              placeholder="Select invoice date"
              invalid={!!e("invoice_date")}
            />
          </FormField>
        </div>

        {/* Dealer */}
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Dealer / sub-dealer name" htmlFor={id("dealer-name")} required error={e("dealer_name")} description="As printed on the invoice">
            <Input id={id("dealer-name")} value={invoice.dealer_name} onChange={(ev) => set("dealer_name", ev.target.value)} aria-invalid={!!e("dealer_name")} maxLength={120} />
          </FormField>
          <FormField label="Dealer phone number" htmlFor={id("dealer-phone")} required error={e("dealer_phone")}>
            <PhoneInput id={id("dealer-phone")} value={invoice.dealer_phone} onValueChange={(v) => set("dealer_phone", v)} aria-invalid={!!e("dealer_phone")} />
          </FormField>
        </div>

        {needsBatch && (
          <FormField
            label="Batch / stamp code"
            htmlFor={id("batch")}
            required
            error={e("batch_code")}
            description="Printed or stamped on the edge or face of the sheets."
          >
            <Input id={id("batch")} value={invoice.batch_code} onChange={(ev) => set("batch_code", ev.target.value)} aria-invalid={!!e("batch_code")} maxLength={40} />
          </FormField>
        )}

        <FieldSeparator />

        {/* Products */}
        <FieldSet>
          <FieldLegend variant="label">Products on this invoice</FieldLegend>
          <FieldDescription>Add each Sylvan product, how many sheets or pieces you bought, and how many are used at this site.</FieldDescription>

          {invoice.items.map((item, j) => {
            const ik = (f: string) => e(`items.${j}.${f}`)
            const product = productById.get(item.product_id)
            const elig =
              product && invoice.invoice_date && invoice.invoice_date <= today
                ? lineEligibility(product, invoice.invoice_date, today, settings)
                : null
            const takenElsewhere = new Set(invoice.items.filter((x) => x.id !== item.id).map((x) => x.product_id))
            const options = products.filter((p) => inFormCategory(p, item.category) && (p.id === item.product_id || !takenElsewhere.has(p.id)))

            return (
              <div key={item.id} className="flex flex-col gap-3 rounded-lg bg-muted/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">Product {j + 1}</span>
                  {invoice.items.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove product ${j + 1}`}
                      onClick={() => onChange((inv) => ({ ...inv, items: inv.items.filter((x) => x.id !== item.id) }))}
                    >
                      <IconTrash />
                    </Button>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Category" htmlFor={id(`${item.id}-cat`)} required>
                    <Select value={item.category || null} onValueChange={(v) => setItem(item.id, { category: v ?? "", product_id: "" })} items={FORM_CATEGORIES}>
                      <SelectTrigger id={id(`${item.id}-cat`)} className="w-full bg-background">
                        <SelectValue placeholder="Plywood SylvanCare+, plywood…" />
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false}>
                        {FORM_CATEGORIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField label="Product" htmlFor={id(`${item.id}-product`)} required error={ik("product_id")}>
                    <Select
                      value={item.product_id || null}
                      onValueChange={(v) => setItem(item.id, { product_id: v ?? "" })}
                      disabled={!item.category}
                      items={options.map((p) => ({ value: p.id, label: p.name }))}
                    >
                      <SelectTrigger id={id(`${item.id}-product`)} className="w-full bg-background" aria-invalid={!!ik("product_id")}>
                        <SelectValue placeholder={item.category ? "Select product" : "Choose a category first"} />
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false}>
                        {options.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField label="Quantity purchased" htmlFor={id(`${item.id}-qp`)} required error={ik("qty_purchased")} description="Sheets / pieces on the invoice">
                    <Input
                      id={id(`${item.id}-qp`)}
                      inputMode="numeric"
                      className="bg-background"
                      value={item.qty_purchased}
                      onChange={(ev) => setItem(item.id, { qty_purchased: ev.target.value.replace(/\D/g, "").slice(0, 6) })}
                      aria-invalid={!!ik("qty_purchased")}
                    />
                  </FormField>
                  <FormField label="Quantity used at this site" htmlFor={id(`${item.id}-qu`)} required error={ik("qty_used")} description="Only these are covered">
                    <Input
                      id={id(`${item.id}-qu`)}
                      inputMode="numeric"
                      className="bg-background"
                      value={item.qty_used}
                      onChange={(ev) => setItem(item.id, { qty_used: ev.target.value.replace(/\D/g, "").slice(0, 6) })}
                      aria-invalid={!!ik("qty_used")}
                    />
                  </FormField>
                </div>
                {elig && (
                  <div className="flex flex-wrap gap-1.5">
                    {product?.care_plus_years != null &&
                      (elig.carePlus ? (
                        <Badge>SylvanCare+ · {product.care_plus_years} years</Badge>
                      ) : (
                        <Badge variant="outline">No SylvanCare+: {elig.carePlusNote}</Badge>
                      ))}
                    {elig.standard ? (
                      <Badge variant="secondary">Standard e-warranty · {product?.standard_period}</Badge>
                    ) : (
                      !elig.carePlus && <Badge variant="outline">{elig.standardNote}</Badge>
                    )}
                    {product?.coverage_note && <Badge variant="outline">{product.coverage_note}</Badge>}
                  </div>
                )}
              </div>
            )
          })}
          <FieldError>{e("items")}</FieldError>
          <Button
            type="button"
            variant="outline"
            className="w-full max-sm:h-10 sm:w-fit"
            disabled={invoice.items.length >= MAX_ITEMS_PER_INVOICE}
            onClick={() => onChange((inv) => ({ ...inv, items: [...inv.items, newItem()] }))}
          >
            <IconPlus data-icon="inline-start" />
            Add product
          </Button>
        </FieldSet>
      </FieldGroup>
    </FieldSet>
  )
}
