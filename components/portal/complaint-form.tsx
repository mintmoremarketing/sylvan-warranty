"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { IconCircleCheck } from "@tabler/icons-react"

import type { ClaimResult } from "@/lib/claim-service"
import { DatePicker } from "@/components/date-picker"
import { doneFiles, FileUploader, isUploading, type UploadItem } from "@/components/file-uploader"
import { FormField } from "@/components/form-field"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldTitle } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { CLAIM_DECLARATION, MAX_CLAIM_PHOTOS, validateClaim, type ClaimItemRef } from "@/lib/domain/claim"
import { COMPLAINT_TYPES } from "@/lib/domain/constants"
import type { FieldErrors } from "@/lib/domain/registration"

const SECTION = "max-xs:rounded-none max-xs:border-y max-xs:ring-0"

type Props = {
  wrn: string
  items: ClaimItemRef[]
  today: string
  submit: (wrn: string, raw: unknown) => Promise<ClaimResult>
  /** Where the claim opens after submitting, e.g. "/my/claims/". */
  doneBase?: string
  /** Customer Care filling the form during a toll-free call. */
  assisted?: boolean
}

export function ComplaintForm({ wrn, items, today, submit, doneBase = "/my/claims/", assisted }: Props) {
  const router = useRouter()
  const [form, setForm] = useState({
    item_id: items.length === 1 ? items[0].id : "",
    complaint_type: "",
    affected_qty: "",
    noticed_on: "",
    description: "",
    declaration: false,
  })
  const [photos, setPhotos] = useState<UploadItem[]>([])
  const [videos, setVideos] = useState<UploadItem[]>([])
  const [showErrors, setShowErrors] = useState(false)
  const [serverErrors, setServerErrors] = useState<FieldErrors>({})
  const [done, setDone] = useState<{ claimNo: string; slug: string } | null>(null)
  const [pending, start] = useTransition()

  const input = useMemo(() => ({ ...form, photos: doneFiles(photos), videos: doneFiles(videos) }), [form, photos, videos])
  const clientErrors = useMemo(() => (showErrors ? validateClaim(input, items, today) : {}), [showErrors, input, items, today])
  const errors: FieldErrors = { ...clientErrors, ...serverErrors }
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }))
    setServerErrors({})
  }
  const item = items.find((i) => i.id === form.item_id)

  return (
    <>
      <form
        noValidate
        className="flex flex-col gap-3 sm:gap-6"
        onSubmit={(e) => {
          e.preventDefault()
          setShowErrors(true)
          if (isUploading(photos) || isUploading(videos)) return void toast.info("Please wait for uploads to finish.")
          const found = validateClaim(input, items, today)
          if (Object.keys(found).length) return void toast.error("Please fix the highlighted fields.")
          start(async () => {
            const res = await submit(wrn, input)
            if (!res.ok) {
              setServerErrors(res.errors ?? {})
              return void toast.error(res.message)
            }
            setDone({ claimNo: res.claimNo, slug: res.slug })
          })
        }}
      >
        <Card className={SECTION}>
          <CardHeader>
            <CardTitle>What&apos;s affected?</CardTitle>
            <CardDescription>Choose the covered product and tell us about the problem.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field data-invalid={!!errors.item_id}>
                <FieldLabel>Affected product</FieldLabel>
                <RadioGroup value={form.item_id} onValueChange={(v) => set("item_id", v as string)} className="grid gap-3 sm:grid-cols-2">
                  {items.map((i) => (
                    <FieldLabel key={i.id} htmlFor={`item-${i.id}`}>
                      <Field orientation="horizontal">
                        <FieldContent>
                          <FieldTitle>{i.product_name}</FieldTitle>
                          <FieldDescription>{i.covered} covered sheets</FieldDescription>
                        </FieldContent>
                        <RadioGroupItem value={i.id} id={`item-${i.id}`} />
                      </Field>
                    </FieldLabel>
                  ))}
                </RadioGroup>
                <FieldError>{errors.item_id}</FieldError>
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <FormField label="Type of problem" htmlFor="complaint_type" required error={errors.complaint_type}>
                  <Select value={form.complaint_type || null} onValueChange={(v) => set("complaint_type", (v as string) ?? "")}>
                    <SelectTrigger id="complaint_type" className="w-full" aria-invalid={!!errors.complaint_type}>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      {COMPLAINT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField
                  label="Approx. affected sheets"
                  htmlFor="affected_qty"
                  required
                  error={errors.affected_qty}
                  description={item ? `Out of ${item.covered} covered` : undefined}
                >
                  <Input id="affected_qty" inputMode="numeric" value={form.affected_qty} onChange={(e) => set("affected_qty", e.target.value.replace(/\D/g, "").slice(0, 6))} aria-invalid={!!errors.affected_qty} />
                </FormField>
                <FormField label="When did you notice it?" htmlFor="noticed_on" required error={errors.noticed_on}>
                  <DatePicker id="noticed_on" value={form.noticed_on} onValueChange={(v) => set("noticed_on", v)} min={item?.care_start ?? undefined} max={today} invalid={!!errors.noticed_on} />
                </FormField>
              </div>
              <FormField label="Describe the problem" htmlFor="description" required error={errors.description} description="Where is it, what does it look like, and when did it start?">
                <Textarea id="description" rows={4} value={form.description} onChange={(e) => set("description", e.target.value)} aria-invalid={!!errors.description} maxLength={3000} />
              </FormField>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card className={SECTION}>
          <CardHeader>
            <CardTitle>Photos and video</CardTitle>
            <CardDescription>Clear photos of the affected area are required — no claim can be settled without photographic evidence.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <FormField label="Photos" htmlFor="photos" required error={errors.photos}>
                <FileUploader id="photos" kind="claim_photo" items={photos} setItems={(fn) => setPhotos(fn)} max={MAX_CLAIM_PHOTOS} invalid={!!errors.photos} label="Add photos" capture />
              </FormField>
              <FormField label="Video (optional)" htmlFor="videos" error={errors.videos} description="A short video helps our team understand the problem.">
                <FileUploader id="videos" kind="claim_video" items={videos} setItems={(fn) => setVideos(fn)} max={1} label="Add a video" />
              </FormField>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card className={SECTION}>
          <CardContent>
            <Field orientation="horizontal" data-invalid={!!errors.declaration}>
              <Checkbox id="declaration" checked={form.declaration} onCheckedChange={(c) => set("declaration", c)} aria-invalid={!!errors.declaration} />
              <FieldContent>
                <FieldLabel htmlFor="declaration" className="font-normal">
                  {assisted ? `The customer confirmed this declaration on the call: “${CLAIM_DECLARATION}”` : CLAIM_DECLARATION}
                </FieldLabel>
                <FieldError>{errors.declaration}</FieldError>
              </FieldContent>
            </Field>
          </CardContent>
          <CardFooter className="flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" size="lg" className="w-full max-sm:h-11 sm:w-auto" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" size="lg" className="w-full max-sm:h-11 sm:w-auto" disabled={pending}>
              {pending && <Spinner data-icon="inline-start" />}
              Submit complaint
            </Button>
          </CardFooter>
        </Card>
      </form>

      <Dialog open={!!done} onOpenChange={(o) => !o && done && router.push(`${doneBase}${done.slug}`)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader className="items-center text-center">
            <IconCircleCheck className="size-12 text-primary" />
            <DialogTitle className="text-lg">Complaint submitted successfully</DialogTitle>
            <DialogDescription>{assisted ? "The Claim ID is" : "Your Claim ID is"}</DialogDescription>
            <p className="font-mono text-xl font-semibold">{done?.claimNo}</p>
          </DialogHeader>
          <p className="text-center text-sm text-muted-foreground">
            {assisted
              ? "The customer has been emailed the Claim ID and can track the complaint in My Care+."
              : "Our team will review it and contact you to schedule a site inspection. Track it any time in My Care+."}
          </p>
          <DialogFooter>
            <Button className="w-full" onClick={() => done && router.push(`${doneBase}${done.slug}`)}>
              {assisted ? "Open claim" : "Track complaint"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
