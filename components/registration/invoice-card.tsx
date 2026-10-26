"use client"

import { IconBuildingStore, IconPencil, IconPlus, IconTrash } from "@tabler/icons-react"

import { DatePicker } from "@/components/date-picker"
import { FileUploader, type UploadItem } from "@/components/file-uploader"
import { FormField } from "@/components/form-field"
import { PhoneInput } from "@/components/phone-input"
import { newItem, type DealerOption, type InvoiceDraft, type ItemDraft } from "@/components/registration/form-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { FieldDescription, FieldError, FieldGroup, FieldLegend, FieldSeparator, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CATEGORIES } from "@/lib/domain/constants"
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
  dealers: DealerOption[]
  settings: EligibilitySettings
  today: string
  error: (key: string) => string | undefined
  canRemove: boolean
  onChange: (update: (inv: InvoiceDraft) => InvoiceDraft) => void
  onRemove: () => void
}

export function InvoiceCard({ invoice, index, products, dealers, settings, today, error, canRemove, onChange, onRemove }: Props) {
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
        {!invoice.dealer_manual ? (
          <FormField
            label="Dealer / sub-dealer"
            htmlFor={id("dealer")}
            required
            error={e("dealer_name")}
            description={
              <Button type="button" variant="link" className="h-auto p-0 text-sm" onClick={() => set("dealer_manual", true)}>
                <IconPencil data-icon="inline-start" />
                My dealer isn&apos;t listed
              </Button>
            }
          >
            <Combobox
              items={dealers}
              value={invoice.dealer}
              onValueChange={(v) => set("dealer", (v as DealerOption | null) ?? null)}
              itemToStringLabel={(d: DealerOption) => d.name}
              isItemEqualToValue={(a: DealerOption, b: DealerOption) => a.id === b.id}
            >
              <ComboboxInput id={id("dealer")} placeholder="Search dealer by name" className="w-full" aria-invalid={!!e("dealer_name")} />
              <ComboboxContent>
                <ComboboxEmpty>No dealer found. Use “My dealer isn&apos;t listed”.</ComboboxEmpty>
                <ComboboxList>
                  {(d: DealerOption) => (
                    <ComboboxItem key={d.id} value={d}>
                      <IconBuildingStore className="text-muted-foreground" />
                      <span className="flex flex-col">
                        <span>{d.name}</span>
                        {d.city && <span className="text-xs text-muted-foreground">{d.city}</span>}
                      </span>
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </FormField>
        ) : (
          <div className="grid gap-5 sm:grid-cols-3">
            <FormField
              label="Dealer name"
              htmlFor={id("dealer-name")}
              required
              error={e("dealer_name")}
              className="sm:col-span-3"
              description={
                <Button type="button" variant="link" className="h-auto p-0 text-sm" onClick={() => set("dealer_manual", false)}>
                  Choose from the dealer list instead
                </Button>
              }
            >
              <Input id={id("dealer-name")} value={invoice.dealer_name} onChange={(ev) => set("dealer_name", ev.target.value)} aria-invalid={!!e("dealer_name")} maxLength={120} />
            </FormField>
            <FormField label="Dealer phone" htmlFor={id("dealer-phone")} required error={e("dealer_phone")} className="sm:col-span-1">
              <PhoneInput id={id("dealer-phone")} value={invoice.dealer_phone} onValueChange={(v) => set("dealer_phone", v)} aria-invalid={!!e("dealer_phone")} />
            </FormField>
            <FormField label="Dealer GSTIN" htmlFor={id("dealer-gstin")} error={e("dealer_gstin")} className="sm:col-span-2" description="Printed on the invoice (15 characters)">
              <Input
                id={id("dealer-gstin")}
                value={invoice.dealer_gstin}
                onChange={(ev) => set("dealer_gstin", ev.target.value.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 15))}
                aria-invalid={!!e("dealer_gstin")}
                className="font-mono uppercase"
              />
            </FormField>
          </div>
        )}

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
            const options = products.filter((p) => p.category === item.category && (p.id === item.product_id || !takenElsewhere.has(p.id)))

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
                    <Select value={item.category || null} onValueChange={(v) => setItem(item.id, { category: v ?? "", product_id: "" })} items={CATEGORIES}>
                      <SelectTrigger id={id(`${item.id}-cat`)} className="w-full bg-background">
                        <SelectValue placeholder="Plywood, blockboard…" />
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false}>
                        {CATEGORIES.map((c) => (
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
                            {p.care_plus_years ? <Badge variant="secondary" className="ml-auto">SylvanCare+</Badge> : null}
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
                      <Badge variant="outline">{elig.standardNote}</Badge>
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
