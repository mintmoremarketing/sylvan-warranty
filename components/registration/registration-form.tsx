"use client"

import { useMemo, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { REGEXP_ONLY_DIGITS } from "input-otp"
import { toast } from "sonner"
import { IconAlertTriangle, IconCircleCheck, IconClockHour4, IconPlus } from "@tabler/icons-react"

import { FileUploader, isUploading, type UploadItem } from "@/components/file-uploader"
import { FormField } from "@/components/form-field"
import { PhoneInput } from "@/components/phone-input"
import {
  initialDraft,
  newInvoice,
  toInput,
  type InvoiceDraft,
  type RegistrationDraft,
  type SubmitResult,
} from "@/components/registration/form-state"
import { InvoiceCard } from "@/components/registration/invoice-card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { APPLICATION_AREAS, INSTALLATION_STATUSES, PROPERTY_TYPES, REFERRAL_TYPES } from "@/lib/domain/constants"
import {
  DECLARATIONS,
  MAX_INVOICES,
  PINCODE_RE,
  validateRegistration,
  type EligibilitySettings,
  type FieldErrors,
  type ProductRef,
  type RegistrationInput,
} from "@/lib/domain/registration"
import type { PincodeInfo } from "@/lib/pincode"

// Sections run edge to edge on phones (below xs) and float as cards above it.
const SECTION = "max-xs:rounded-none max-xs:ring-0 max-xs:border-y"

type Props = {
  mode: "customer" | "assisted"
  defaults: { email: string; name?: string | null; mobile?: string | null }
  products: ProductRef[]
  settings: EligibilitySettings
  today: string
  submit: (input: RegistrationInput) => Promise<SubmitResult>
  confirmConsent?: (otpId: string, code: string) => Promise<SubmitResult>
  /** Where to go after submitting; the registration slug is appended. */
  doneBase: string
}

function scrollToFirstError() {
  requestAnimationFrame(() => {
    const field = document.querySelector<HTMLElement>('[data-invalid="true"]')
    field?.scrollIntoView({ behavior: "smooth", block: "center" })
    field?.querySelector<HTMLElement>("input:not([type=file]), button, textarea")?.focus({ preventScroll: true })
  })
}

export function RegistrationForm({ mode, defaults, products, settings, today, submit, confirmConsent, doneBase }: Props) {
  const router = useRouter()
  const [draft, setDraft] = useState<RegistrationDraft>(() => initialDraft(defaults))
  const [showErrors, setShowErrors] = useState(false)
  const [serverErrors, setServerErrors] = useState<FieldErrors>({})
  const [pin, setPin] = useState<{ loading: boolean; error?: string }>({ loading: false })
  const [done, setDone] = useState<Extract<SubmitResult, { kind: "registered" }> | null>(null)
  const [consent, setConsent] = useState<{ otpId: string; email: string } | null>(null)
  const [consentCode, setConsentCode] = useState("")
  const [consentError, setConsentError] = useState("")
  const [pending, start] = useTransition()
  const pinRequest = useRef<AbortController | null>(null)

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const ctx = useMemo(() => ({ products: productMap, settings, today }), [productMap, settings, today])
  const clientErrors = useMemo(
    () => (showErrors ? validateRegistration(toInput(draft), ctx).errors : {}),
    [showErrors, draft, ctx]
  )
  const errors = { ...clientErrors, ...serverErrors }
  const error = (key: string) => errors[key]

  function update(fn: (d: RegistrationDraft) => RegistrationDraft) {
    setDraft(fn)
    setServerErrors((prev) => (Object.keys(prev).length ? {} : prev))
  }
  const set = <K extends keyof RegistrationDraft>(key: K, value: RegistrationDraft[K]) => update((d) => ({ ...d, [key]: value }))
  const patchInvoice = (id: string, fn: (inv: InvoiceDraft) => InvoiceDraft) =>
    update((d) => ({ ...d, invoices: d.invoices.map((inv) => (inv.id === id ? fn(inv) : inv)) }))

  function onPincodeChange(value: string) {
    const pincode = value.replace(/\D/g, "").slice(0, 6)
    update((d) => ({ ...d, pincode, state: "", districts: [], district: "" }))
    pinRequest.current?.abort()
    setPin({ loading: false })
    if (!PINCODE_RE.test(pincode)) return
    const request = new AbortController()
    pinRequest.current = request
    setPin({ loading: true })
    fetch(`/api/pincode/${pincode}`, { signal: request.signal })
      .then(async (res) => {
        const body = await res.json()
        if (!res.ok) throw new Error(body.error ?? "Pincode lookup failed")
        return body as PincodeInfo
      })
      .then((info) => {
        setDraft((d) =>
          d.pincode !== pincode
            ? d
            : { ...d, state: info.state, districts: info.districts, district: info.districts.length === 1 ? info.districts[0] : "" }
        )
        setPin({ loading: false })
      })
      .catch((err: Error) => {
        if (!request.signal.aborted) setPin({ loading: false, error: err.message })
      })
  }

  function handleResult(res: SubmitResult) {
    if (!res.ok) {
      setServerErrors(res.errors ?? {})
      toast.error(res.message)
      if (res.errors) scrollToFirstError()
      return
    }
    if (res.kind === "consent_required") {
      setConsent({ otpId: res.otpId, email: res.email })
      setConsentCode("")
      setConsentError("")
      return
    }
    setConsent(null)
    setDone(res)
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setShowErrors(true)
    if (pin.loading) return void toast.info("Still looking up your pincode — one moment.")
    if (draft.invoices.some((inv) => isUploading(inv.files)) || isUploading(draft.site_photos))
      return void toast.info("Please wait for uploads to finish.")
    const input = toInput(draft)
    const { errors: found } = validateRegistration(input, ctx)
    const count = Object.keys(found).length
    if (count) {
      toast.error(`Please fix ${count} highlighted field${count === 1 ? "" : "s"}.`)
      return scrollToFirstError()
    }
    start(async () => handleResult(await submit(input)))
  }

  const carePlusLines = draft.invoices.flatMap((inv) =>
    inv.items.filter((it) => productMap.get(it.product_id)?.care_plus_years != null)
  ).length

  return (
    <>
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-3 sm:gap-6">
        {/* Owner & site */}
        <Card className={SECTION}>
          <CardHeader>
            <CardTitle>Home / site owner</CardTitle>
            <CardDescription>The warranty is issued only in the owner&apos;s name, and only they can claim.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <div className="grid gap-5 sm:grid-cols-2">
                <FormField label="Owner name" htmlFor="owner_name" required error={error("owner_name")}>
                  <Input id="owner_name" autoComplete="name" value={draft.owner_name} onChange={(e) => set("owner_name", e.target.value)} aria-invalid={!!error("owner_name")} maxLength={80} />
                </FormField>
                <FormField label="Mobile number" htmlFor="owner_mobile" required error={error("owner_mobile")}>
                  <PhoneInput id="owner_mobile" value={draft.owner_mobile} onValueChange={(v) => set("owner_mobile", v)} aria-invalid={!!error("owner_mobile")} />
                </FormField>
                <FormField
                  label="Email"
                  htmlFor="owner_email"
                  required
                  error={error("owner_email")}
                  className="sm:col-span-2"
                  description={mode === "customer" ? "Your login email. Certificates and updates are sent here." : "The customer receives a code here to confirm consent."}
                >
                  <Input
                    id="owner_email"
                    type="email"
                    value={draft.owner_email}
                    disabled={mode === "customer"}
                    onChange={(e) => set("owner_email", e.target.value)}
                    aria-invalid={!!error("owner_email")}
                  />
                </FormField>
              </div>

              <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-900">
                <IconAlertTriangle />
                <AlertDescription className="text-current">
                  Enter the address where the products are installed. Claims must match these site details.
                </AlertDescription>
              </Alert>

              <FormField label="Site address" htmlFor="site_address" required error={error("site_address")}>
                <Textarea id="site_address" rows={2} autoComplete="street-address" placeholder="House / flat no., building, street, area" value={draft.site_address} onChange={(e) => set("site_address", e.target.value)} aria-invalid={!!error("site_address")} maxLength={300} />
              </FormField>

              <div className="grid gap-5 sm:grid-cols-2">
                <FormField label="Pincode" htmlFor="pincode" required error={error("pincode") ?? pin.error}>
                  <InputGroup>
                    <InputGroupInput id="pincode" inputMode="numeric" autoComplete="postal-code" maxLength={6} value={draft.pincode} onChange={(e) => onPincodeChange(e.target.value)} aria-invalid={!!(error("pincode") ?? pin.error)} />
                    {pin.loading && (
                      <InputGroupAddon align="inline-end">
                        <Spinner />
                      </InputGroupAddon>
                    )}
                  </InputGroup>
                </FormField>
                <FormField label="City / town" htmlFor="city" required error={error("city")}>
                  <Input id="city" autoComplete="address-level2" value={draft.city} onChange={(e) => set("city", e.target.value)} aria-invalid={!!error("city")} maxLength={60} />
                </FormField>
                <FormField label="District" htmlFor="district" required error={error("district")}>
                  <Select value={draft.district || null} onValueChange={(v) => set("district", v ?? "")} disabled={draft.districts.length === 0}>
                    <SelectTrigger id="district" className="w-full" aria-invalid={!!error("district")}>
                      <SelectValue placeholder={draft.districts.length ? "Select district" : "Filled from pincode"} />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      {draft.districts.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="State" htmlFor="state" required>
                  <Input id="state" readOnly tabIndex={-1} placeholder="Filled from pincode" value={draft.state} className="bg-muted" />
                </FormField>
              </div>
            </FieldGroup>
          </CardContent>
        </Card>

        {/* Purchase */}
        <Card className={SECTION}>
          <CardHeader>
            <CardTitle>Purchase details</CardTitle>
            <CardDescription>
              Add each invoice and the Sylvan products on it. SylvanCare+ covers Z+ Premium, Premium Club and Elite Plus plywood; every other product gets a standard e-warranty.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              {draft.invoices.map((inv, i) => (
                <InvoiceCard
                  key={inv.id}
                  invoice={inv}
                  index={i}
                  products={products}
                  settings={settings}
                  today={today}
                  error={error}
                  canRemove={draft.invoices.length > 1}
                  onChange={(fn) => patchInvoice(inv.id, fn)}
                  onRemove={() => update((d) => ({ ...d, invoices: d.invoices.filter((x) => x.id !== inv.id) }))}
                />
              ))}
              <FieldError>{error("invoices")}</FieldError>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="max-sm:h-11"
                disabled={draft.invoices.length >= MAX_INVOICES}
                onClick={() => update((d) => ({ ...d, invoices: [...d.invoices, newInvoice()] }))}
              >
                <IconPlus data-icon="inline-start" />
                Add another invoice
              </Button>
            </FieldGroup>
          </CardContent>
        </Card>

        {/* Installation */}
        <Card className={SECTION}>
          <CardHeader>
            <CardTitle>Installation details</CardTitle>
            <CardDescription>Helps us verify the site and, if needed, plan an inspection.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <div className="grid gap-5 sm:grid-cols-2">
                <FormField label="Property type" htmlFor="property_type" required error={error("property_type")}>
                  <Select value={draft.property_type || null} onValueChange={(v) => set("property_type", v ?? "")} items={PROPERTY_TYPES}>
                    <SelectTrigger id="property_type" className="w-full" aria-invalid={!!error("property_type")}>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      {PROPERTY_TYPES.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Installation status" htmlFor="installation_status" required error={error("installation_status")}>
                  <Select value={draft.installation_status || null} onValueChange={(v) => set("installation_status", v ?? "")} items={INSTALLATION_STATUSES}>
                    <SelectTrigger id="installation_status" className="w-full" aria-invalid={!!error("installation_status")}>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      {INSTALLATION_STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
              <Field data-invalid={!!error("application_areas")}>
                <FieldLabel>
                  Where are the products used?<span aria-hidden className="-ml-1.5 text-primary">*</span>
                </FieldLabel>
                <ToggleGroup
                  multiple
                  variant="outline"
                  spacing={2}
                  value={draft.application_areas}
                  onValueChange={(v) => set("application_areas", v as string[])}
                  className="flex-wrap"
                >
                  {APPLICATION_AREAS.map((a) => (
                    <ToggleGroupItem key={a} value={a} className="max-sm:h-10">
                      {a}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <FieldError>{error("application_areas")}</FieldError>
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <FormField label="Carpenter / contractor name" htmlFor="carpenter_name" error={error("carpenter_name")}>
                  <Input id="carpenter_name" value={draft.carpenter_name} onChange={(e) => set("carpenter_name", e.target.value)} aria-invalid={!!error("carpenter_name")} maxLength={80} />
                </FormField>
                <FormField label="Carpenter / contractor mobile" htmlFor="carpenter_mobile" error={error("carpenter_mobile")}>
                  <PhoneInput id="carpenter_mobile" value={draft.carpenter_mobile} onValueChange={(v) => set("carpenter_mobile", v)} aria-invalid={!!error("carpenter_mobile")} />
                </FormField>
              </div>
              <FormField label="Site / installation photos" htmlFor="site_photos" description="Optional, but it can speed up verification.">
                <FileUploader
                  id="site_photos"
                  kind="site_photo"
                  items={draft.site_photos}
                  setItems={(fn: (prev: UploadItem[]) => UploadItem[]) => update((d) => ({ ...d, site_photos: fn(d.site_photos) }))}
                  max={10}
                  label="Add site photos"
                  capture={mode === "assisted"}
                />
              </FormField>
            </FieldGroup>
          </CardContent>
        </Card>

        {/* Referral */}
        <Card className={SECTION}>
          <CardHeader>
            <CardTitle>Referral (optional)</CardTitle>
            <CardDescription>Did an architect, interior designer or Sylvan sales person recommend Sylvan?</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField label="Referred by" htmlFor="referred_by">
                <Select value={draft.referred_by || null} onValueChange={(v) => set("referred_by", v ?? "")} items={REFERRAL_TYPES}>
                  <SelectTrigger id="referred_by" className="w-full">
                    <SelectValue placeholder="Not referred" />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    {REFERRAL_TYPES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Referrer name" htmlFor="referrer_name" required={!!draft.referred_by} error={error("referrer_name")}>
                <Input id="referrer_name" value={draft.referrer_name} onChange={(e) => set("referrer_name", e.target.value)} aria-invalid={!!error("referrer_name")} maxLength={80} />
              </FormField>
              <FormField label="Referrer mobile" htmlFor="referrer_mobile" error={error("referrer_mobile")}>
                <PhoneInput id="referrer_mobile" value={draft.referrer_mobile} onValueChange={(v) => set("referrer_mobile", v)} aria-invalid={!!error("referrer_mobile")} />
              </FormField>
              <FormField label="Referrer email" htmlFor="referrer_email" error={error("referrer_email")}>
                <Input id="referrer_email" type="email" value={draft.referrer_email} onChange={(e) => set("referrer_email", e.target.value)} aria-invalid={!!error("referrer_email")} />
              </FormField>
            </div>
          </CardContent>
        </Card>

        {/* Declaration */}
        <Card className={SECTION}>
          <CardContent className="flex flex-col gap-5">
            <Item variant="muted">
              <ItemMedia variant="icon">
                <IconClockHour4 />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>What happens next?</ItemTitle>
                <ItemDescription className="line-clamp-none">
                  You get a Warranty Registration Number (WRN) straight away.
                  {carePlusLines > 0
                    ? " Our team verifies your invoice and details — sometimes with a site visit — and your SylvanCare+ certificate is emailed once approved (usually within 48 working hours)."
                    : ""}{" "}
                  Standard e-warranty certificates are issued by your area&apos;s Sylvan sales coordinator.
                </ItemDescription>
              </ItemContent>
            </Item>

            {(Object.keys(DECLARATIONS) as (keyof typeof DECLARATIONS)[]).map((key) => (
              <Field key={key} orientation="horizontal" data-invalid={!!error(`declarations.${key}`)}>
                <Checkbox
                  id={`decl-${key}`}
                  checked={draft.declarations[key]}
                  onCheckedChange={(c) => update((d) => ({ ...d, declarations: { ...d.declarations, [key]: c } }))}
                  aria-invalid={!!error(`declarations.${key}`)}
                />
                <FieldContent>
                  <FieldLabel htmlFor={`decl-${key}`} className="font-normal">
                    {DECLARATIONS[key]}
                  </FieldLabel>
                  {key === "policy" && (
                    <FieldDescription>
                      Read the <Link href="/policy" target="_blank">SylvanCare+ policy and standard warranty terms</Link>.
                    </FieldDescription>
                  )}
                  <FieldError>{error(`declarations.${key}`)}</FieldError>
                </FieldContent>
              </Field>
            ))}
          </CardContent>
          <CardFooter className="flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" size="lg" className="w-full max-sm:h-11 sm:w-auto" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" size="lg" className="w-full max-sm:h-11 sm:w-auto" disabled={pending}>
              {pending && <Spinner data-icon="inline-start" />}
              {mode === "assisted" ? "Send consent code to customer" : "Submit registration"}
            </Button>
          </CardFooter>
        </Card>
      </form>

      {/* Assisted: customer reads out the emailed code */}
      <Dialog open={!!consent} onOpenChange={(o) => !o && setConsent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Customer consent</DialogTitle>
            <DialogDescription>
              We emailed a 6-digit code to <span className="font-medium text-foreground">{consent?.email}</span>. Ask the customer to read it out — entering it records their consent to the registration and the policy.
            </DialogDescription>
          </DialogHeader>
          <Field data-invalid={!!consentError}>
            <InputOTP maxLength={6} pattern={REGEXP_ONLY_DIGITS} value={consentCode} onChange={setConsentCode} aria-invalid={!!consentError}>
              <InputOTPGroup className="*:data-[slot=input-otp-slot]:size-11 *:data-[slot=input-otp-slot]:text-lg">
                {Array.from({ length: 6 }, (_, i) => (
                  <InputOTPSlot key={i} index={i} aria-invalid={!!consentError} />
                ))}
              </InputOTPGroup>
            </InputOTP>
            <FieldError>{consentError}</FieldError>
          </Field>
          <DialogFooter>
            <Button
              disabled={pending || consentCode.length !== 6}
              onClick={() =>
                start(async () => {
                  if (!consent || !confirmConsent) return
                  const res = await confirmConsent(consent.otpId, consentCode)
                  if (!res.ok && !res.errors) return setConsentError(res.message)
                  handleResult(res)
                })
              }
            >
              {pending && <Spinner data-icon="inline-start" />}
              Confirm and submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success: WRN pop-up from the brief */}
      <Dialog open={!!done} onOpenChange={(o) => !o && done && router.push(`${doneBase}${done.slug}`)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader className="items-center text-center">
            <IconCircleCheck className="size-12 text-primary" />
            <DialogTitle className="text-lg">Registration submitted successfully</DialogTitle>
            <DialogDescription>Your Warranty Registration Number is</DialogDescription>
            <p className="font-mono text-2xl font-semibold tracking-wide">{done?.wrn}</p>
          </DialogHeader>
          <div className="flex flex-col gap-2 text-sm">
            {done?.carePlus && <Badge className="mx-auto">SylvanCare+ verification has started</Badge>}
            {!!done?.eWarranties && (
              <Badge variant="secondary" className="mx-auto">
                {done.eWarranties} standard e-warranty certificate{done.eWarranties > 1 ? "s" : ""} being prepared
              </Badge>
            )}
            <p className="text-center text-muted-foreground">A confirmation email is on its way. You can track everything in My Care+.</p>
          </div>
          <DialogFooter>
            <Button className="w-full" onClick={() => done && router.push(`${doneBase}${done.slug}`)}>
              View registration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
