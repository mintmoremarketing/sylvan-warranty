"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { IconCertificate, IconDeviceFloppy, IconX } from "@tabler/icons-react"

import { issueEWarranty, rejectEWarranty, saveEWarranty, type EWarrantyEdit } from "@/app/console/(app)/e-warranties/actions"
import { ActionBar, ActionDrawer } from "@/components/console/action-drawer"
import { CONSOLE_CARD } from "@/components/console/page-header"
import { FormField } from "@/components/form-field"
import { PhoneInput } from "@/components/phone-input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FieldError, FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { categoryLabel } from "@/lib/domain/constants"

type Option = { value: string; label: string }

export function EWarrantyEditor({
  id,
  initial,
  items,
  products,
  coordinators,
  isWpc,
  canAssign,
}: {
  id: string
  initial: Omit<EWarrantyEdit, "items">
  items: { id: string; product_id: string; qty: number; category: string; invoice_number: string }[]
  products: { id: string; name: string; category: string }[]
  coordinators: Option[]
  isWpc: boolean
  canAssign: boolean
}) {
  const router = useRouter()
  const [form, setForm] = useState(initial)
  const [rows, setRows] = useState(items.map((i) => ({ id: i.id, product_id: i.product_id, qty: String(i.qty), category: i.category, invoice_number: i.invoice_number })))
  const [error, setError] = useState("")
  const [saving, start] = useTransition()
  const [rejectReason, setRejectReason] = useState("")
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))
  const payload = (): EWarrantyEdit => ({ ...form, items: rows.map(({ id, product_id, qty }) => ({ id, product_id, qty })) })

  const save = () =>
    new Promise<boolean>((resolve) =>
      start(async () => {
        setError("")
        const res = await saveEWarranty(id, payload())
        if (!res.ok) {
          setError(res.error)
          return resolve(false)
        }
        resolve(true)
      })
    )

  return (
    <>
      <Card className={CONSOLE_CARD}>
        <CardHeader>
          <CardTitle>Certificate details</CardTitle>
          <CardDescription>Correct anything that doesn&apos;t match the invoice before issuing. Every edit is logged.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField label="Customer name" htmlFor="ew-name" required>
                <Input id="ew-name" value={form.customer_name} onChange={(e) => set("customer_name", e.target.value)} />
              </FormField>
              <FormField label="Contact number" htmlFor="ew-mobile" required>
                <PhoneInput id="ew-mobile" value={form.customer_mobile} onValueChange={(v) => set("customer_mobile", v)} />
              </FormField>
            </div>
            <FormField label="Address" htmlFor="ew-address" required>
              <Textarea id="ew-address" rows={2} value={form.customer_address} onChange={(e) => set("customer_address", e.target.value)} />
            </FormField>
            <div className="grid gap-5 sm:grid-cols-3">
              <FormField label="Dealer / sub-dealer / OEM" htmlFor="ew-dealer" required className="sm:col-span-3">
                <Input id="ew-dealer" value={form.dealer_name} onChange={(e) => set("dealer_name", e.target.value)} />
              </FormField>
              <FormField label="Invoice no." htmlFor="ew-inv" required>
                <Input id="ew-inv" value={form.invoice_number} onChange={(e) => set("invoice_number", e.target.value)} />
              </FormField>
              <FormField label="Invoice date" htmlFor="ew-date" description={isWpc ? undefined : "Editable for WPC only"}>
                <Input id="ew-date" type="date" value={form.invoice_date} disabled={!isWpc} onChange={(e) => set("invoice_date", e.target.value)} />
              </FormField>
              {canAssign && (
                <FormField label="Sales coordinator" htmlFor="ew-coord">
                  <Select value={form.coordinator_id || null} onValueChange={(v) => set("coordinator_id", (v as string) ?? "")} items={coordinators}>
                    <SelectTrigger id="ew-coord" className="w-full">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      {coordinators.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              )}
            </div>
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium">Products</p>
              {rows.map((r) => {
                // Brief: category and quantity are editable for PLY / BB / FD; product name for all.
                const options = products
                  .filter((p) => !isWpc || p.category === r.category)
                  .map((p) => ({ value: p.id, label: isWpc ? p.name : `${p.name} · ${categoryLabel(p.category)}` }))
                return (
                  <div key={r.id} className="grid gap-3 rounded-lg bg-muted/60 p-3 sm:grid-cols-[1fr_7rem]">
                    <FormField label={isWpc ? `${categoryLabel(r.category)} · invoice ${r.invoice_number}` : `Category and product · invoice ${r.invoice_number}`} htmlFor={`ew-p-${r.id}`}>
                      <Select
                        value={r.product_id}
                        onValueChange={(v) =>
                          setRows((rs) =>
                            rs.map((x) => (x.id === r.id && v ? { ...x, product_id: v as string, category: products.find((p) => p.id === v)?.category ?? x.category } : x))
                          )
                        }
                        items={options}
                      >
                        <SelectTrigger id={`ew-p-${r.id}`} className="w-full bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent alignItemWithTrigger={false}>
                          {options.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormField>
                    <FormField label="Quantity" htmlFor={`ew-q-${r.id}`}>
                      <Input id={`ew-q-${r.id}`} inputMode="numeric" className="bg-background" value={r.qty} readOnly={isWpc} onChange={(e) => setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, qty: e.target.value.replace(/\D/g, "") } : x)))} />
                    </FormField>
                  </div>
                )
              })}
            </div>
            <FieldError>{error}</FieldError>
          </FieldGroup>
        </CardContent>
      </Card>
      <ActionBar>
        <Button
          variant="outline"
          className="h-10 flex-1 sm:flex-none"
          disabled={saving}
          onClick={async () => {
            if (await save()) {
              toast.success("Changes saved")
              router.refresh()
            }
          }}
        >
          {saving ? <Spinner data-icon="inline-start" /> : <IconDeviceFloppy data-icon="inline-start" />}
          Save changes
        </Button>
        <ActionDrawer
          trigger={<Button className="h-10 flex-1 sm:flex-none" />}
          label={<><IconCertificate data-icon="inline-start" />Issue e-warranty</>}
          title="Issue the e-warranty certificate"
          description="Saves your changes, assigns the next warranty number and emails the certificate to the customer."
          submitLabel="Issue certificate"
          success="E-warranty issued and emailed"
          run={async () => {
            const res = await saveEWarranty(id, payload())
            if (!res.ok) return res
            return issueEWarranty(id)
          }}
        />
        <ActionDrawer
          trigger={<Button variant="destructive" className="h-10 flex-1 sm:flex-none" />}
          label={<><IconX data-icon="inline-start" />Don&apos;t issue</>}
          title="Don't issue this e-warranty"
          submitLabel="Confirm"
          destructive
          success="Marked as not issued"
          run={() => rejectEWarranty(id, rejectReason)}
        >
          <FormField label="Reason" htmlFor="ew-reject" required>
            <Textarea id="ew-reject" rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
          </FormField>
        </ActionDrawer>
      </ActionBar>
    </>
  )
}
