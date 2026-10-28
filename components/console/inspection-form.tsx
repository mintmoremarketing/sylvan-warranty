"use client"

import { useEffect, useMemo, useState, useSyncExternalStore, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { IconCurrentLocation, IconMapPin } from "@tabler/icons-react"

import { submitInspection } from "@/app/console/(app)/inspections/actions"
import { CONSOLE_CARD } from "@/components/console/page-header"
import { doneFiles, FileUploader, isUploading, type UploadItem } from "@/components/file-uploader"
import { FormField } from "@/components/form-field"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldTitle } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { validateInspection, type FieldDef, type FormDef } from "@/lib/domain/inspection-forms"

type Geo = { lat: number; lng: number; accuracy: number }

const noopSubscribe = () => () => {}
function readDraft(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

const YNU = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "unable", label: "Unable to verify" },
]

export function InspectionForm({ id, form }: { id: string; form: FormDef }) {
  const router = useRouter()
  const draftKey = `inspection-draft-${id}`
  const [values, setValues] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [media, setMedia] = useState<Record<string, UploadItem[]>>({})
  const [geo, setGeo] = useState<Geo | null>(null)
  const [geoNote, setGeoNote] = useState("")
  const [locating, setLocating] = useState(false)
  const [ackName, setAckName] = useState("")
  const [ackConfirmed, setAckConfirmed] = useState(false)
  const [declared, setDeclared] = useState(false)
  const [outcome, setOutcome] = useState<"completed" | "revisit_required">("completed")
  const [showErrors, setShowErrors] = useState(false)
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({})
  const [pending, start] = useTransition()

  // Answers are kept on the phone as a draft, so a dropped signal or a closed tab loses nothing.
  // Photos upload as they're taken, but need re-adding if the page reloads.
  const savedDraft = useSyncExternalStore(
    noopSubscribe,
    () => readDraft(draftKey),
    () => null
  )
  const [draftDismissed, setDraftDismissed] = useState(false)
  const touched = Object.keys(values).length > 0
  useEffect(() => {
    if (!touched) return
    try {
      localStorage.setItem(draftKey, JSON.stringify({ values, notes, ackName }))
    } catch {}
  }, [draftKey, touched, values, notes, ackName])
  function restoreDraft() {
    const saved = savedDraft ? JSON.parse(savedDraft) : null
    if (saved) {
      setValues(saved.values ?? {})
      setNotes(saved.notes ?? {})
      setAckName(saved.ackName ?? "")
    }
    setDraftDismissed(true)
  }

  const counts = useMemo(() => Object.fromEntries(Object.entries(media).map(([k, v]) => [k, doneFiles(v).length])), [media])
  const clientErrors = useMemo(() => {
    if (!showErrors) return {}
    const e: Record<string, string> = outcome === "completed" ? validateInspection(form, { values, notes }, counts) : {}
    if (outcome === "revisit_required" && !(values.remarks ?? "").trim()) e.remarks = "Explain why a revisit is needed"
    if (!geo && !geoNote.trim()) e.geo = "Capture the location, or explain why it isn't available"
    if (!declared) e.declared = "Confirm the inspector declaration"
    if (outcome === "completed" && (!ackConfirmed || !ackName.trim())) e.ack = "Record the customer / site owner acknowledgement"
    return e
  }, [showErrors, outcome, form, values, notes, counts, geo, geoNote, declared, ackConfirmed, ackName])
  const errors = { ...clientErrors, ...serverErrors }

  const setValue = (key: string, v: string) => {
    setValues((s) => ({ ...s, [key]: v }))
    setServerErrors({})
  }
  const mediaSetter = (key: string) => (fn: (prev: UploadItem[]) => UploadItem[]) => setMedia((m) => ({ ...m, [key]: fn(m[key] ?? []) }))

  function locate() {
    if (!navigator.geolocation) return toast.error("Location isn't available on this device.")
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setGeo({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) })
        setLocating(false)
      },
      (err) => {
        setLocating(false)
        toast.error(err.code === 1 ? "Location permission was denied." : "Couldn't get your location. Try again outside or near a window.")
      },
      { enableHighAccuracy: true, timeout: 20000 }
    )
  }

  function renderField(f: FieldDef) {
    const err = errors[f.key]
    switch (f.type) {
      case "text":
        return (
          <FormField key={f.key} label={f.label} htmlFor={f.key} required={f.required} error={err} description={f.help}>
            <Input id={f.key} value={values[f.key] ?? ""} onChange={(e) => setValue(f.key, e.target.value)} aria-invalid={!!err} />
          </FormField>
        )
      case "textarea":
        return (
          <FormField key={f.key} label={f.label} htmlFor={f.key} required={f.required} error={err} description={f.help}>
            <Textarea id={f.key} rows={3} value={values[f.key] ?? ""} onChange={(e) => setValue(f.key, e.target.value)} aria-invalid={!!err} />
          </FormField>
        )
      case "number":
        return (
          <FormField key={f.key} label={f.label} htmlFor={f.key} required={f.required} error={err} description={f.help}>
            <InputGroup>
              <InputGroupInput id={f.key} inputMode="decimal" value={values[f.key] ?? ""} onChange={(e) => setValue(f.key, e.target.value.replace(/[^\d.]/g, ""))} aria-invalid={!!err} />
              {f.unit && (
                <InputGroupAddon align="inline-end">
                  <InputGroupText>{f.unit}</InputGroupText>
                </InputGroupAddon>
              )}
            </InputGroup>
          </FormField>
        )
      case "select":
        return (
          <FormField key={f.key} label={f.label} htmlFor={f.key} required={f.required} error={err}>
            <Select value={values[f.key] || null} onValueChange={(v) => setValue(f.key, (v as string) ?? "")}>
              <SelectTrigger id={f.key} className="w-full" aria-invalid={!!err}>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {f.options.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        )
      case "ynu": {
        const adverse = f.adverse && values[f.key] === f.adverse
        return (
          <Field key={f.key} data-invalid={!!err} className="gap-2 border-b pb-4 last:border-b-0">
            <FieldLabel>
              {f.label}
              {f.required && <span aria-hidden className="-ml-1.5 text-primary">*</span>}
            </FieldLabel>
            <ToggleGroup
              variant="outline"
              spacing={2}
              value={values[f.key] ? [values[f.key]] : []}
              onValueChange={(v) => setValue(f.key, (v as string[])[0] ?? "")}
              className="w-full"
            >
              {YNU.map((o) => (
                <ToggleGroupItem key={o.value} value={o.value} className="h-10 flex-1">
                  {o.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <FieldError>{err}</FieldError>
            {adverse && (
              <div className="flex flex-col gap-3 rounded-lg bg-muted/60 p-3">
                <FormField label="What did you observe?" htmlFor={`${f.key}-note`} required error={errors[`${f.key}.note`]}>
                  <Textarea id={`${f.key}-note`} rows={2} className="bg-background" value={notes[f.key] ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [f.key]: e.target.value }))} />
                </FormField>
                <FormField label="Photo evidence" htmlFor={`${f.key}-evidence`} required error={errors[`${f.key}.evidence`]}>
                  <FileUploader id={`${f.key}-evidence`} kind="inspection_photo" items={media[`evidence:${f.key}`] ?? []} setItems={mediaSetter(`evidence:${f.key}`)} max={5} label="Take photo" capture />
                </FormField>
              </div>
            )}
          </Field>
        )
      }
      case "photos":
        return (
          <FormField key={f.key} label={f.label} htmlFor={f.key} required error={err} description={f.help ?? `At least ${f.min}`}>
            <FileUploader id={f.key} kind="inspection_photo" items={media[f.key] ?? []} setItems={mediaSetter(f.key)} max={f.max ?? 10} invalid={!!err} label="Take or add photos" capture />
          </FormField>
        )
      case "video":
        return (
          <FormField key={f.key} label={f.label} htmlFor={f.key} error={err} description={f.help}>
            <FileUploader id={f.key} kind="inspection_video" items={media[f.key] ?? []} setItems={mediaSetter(f.key)} max={2} label="Record or add video" capture />
          </FormField>
        )
    }
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-3 sm:gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        setShowErrors(true)
        if (Object.values(media).some(isUploading)) return void toast.info("Please wait for uploads to finish.")
        start(async () => {
          const res = await submitInspection(id, {
            answers: { values, notes },
            media: Object.fromEntries(Object.entries(media).map(([k, v]) => [k, doneFiles(v)])),
            geo,
            geoNote,
            ackName,
            ackConfirmed,
            declared,
            outcome,
          })
          if (!res.ok) {
            setServerErrors(res.errors ?? {})
            toast.error(res.error)
            requestAnimationFrame(() => document.querySelector('[data-invalid="true"]')?.scrollIntoView({ behavior: "smooth", block: "center" }))
            return
          }
          localStorage.removeItem(draftKey)
          toast.success(outcome === "completed" ? "Inspection submitted" : "Revisit recorded")
          router.refresh()
        })
      }}
    >
      {savedDraft && !touched && !draftDismissed && (
        <Alert className="max-sm:mx-4 max-sm:w-auto">
          <AlertTitle>You have a saved draft for this inspection</AlertTitle>
          <AlertDescription className="flex flex-wrap gap-2 pt-1">
            <Button type="button" size="sm" onClick={restoreDraft}>
              Restore answers
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setDraftDismissed(true)}>
              Start fresh
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <Card className={CONSOLE_CARD}>
        <CardHeader>
          <CardTitle>Location</CardTitle>
          <CardDescription>Capture GPS at the site to confirm the visit location.</CardDescription>
        </CardHeader>
        <CardContent>
          <Field data-invalid={!!errors.geo}>
            {geo ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <IconMapPin className="size-4 text-primary" />
                <span className="font-mono">
                  {geo.lat.toFixed(5)}, {geo.lng.toFixed(5)}
                </span>
                <span className="text-muted-foreground">±{geo.accuracy} m</span>
                <Button variant="link" className="h-auto p-0" render={<a href={`https://www.google.com/maps?q=${geo.lat},${geo.lng}`} target="_blank" rel="noreferrer" />} nativeButton={false}>
                  View on map
                </Button>
              </div>
            ) : null}
            <Button type="button" variant={geo ? "outline" : "default"} className="h-11 w-full sm:w-fit" onClick={locate} disabled={locating}>
              {locating ? <Spinner data-icon="inline-start" /> : <IconCurrentLocation data-icon="inline-start" />}
              {geo ? "Recapture location" : "Capture location"}
            </Button>
            {!geo && (
              <Input placeholder="Or explain why location isn't available" value={geoNote} onChange={(e) => setGeoNote(e.target.value)} aria-invalid={!!errors.geo} />
            )}
            <FieldError>{errors.geo}</FieldError>
          </Field>
        </CardContent>
      </Card>

      <Card className={CONSOLE_CARD}>
        <CardHeader>
          <CardTitle>Outcome of the visit</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup value={outcome} onValueChange={(v) => setOutcome(v as typeof outcome)} className="grid gap-3 sm:grid-cols-2">
            <FieldLabel htmlFor="outcome-done">
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldTitle>Inspection completed</FieldTitle>
                  <FieldDescription>Fill in every section below.</FieldDescription>
                </FieldContent>
                <RadioGroupItem value="completed" id="outcome-done" />
              </Field>
            </FieldLabel>
            <FieldLabel htmlFor="outcome-revisit">
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldTitle>Revisit required</FieldTitle>
                  <FieldDescription>Installation unavailable — add remarks only.</FieldDescription>
                </FieldContent>
                <RadioGroupItem value="revisit_required" id="outcome-revisit" />
              </Field>
            </FieldLabel>
          </RadioGroup>
        </CardContent>
      </Card>

      {form.sections
        .filter((s) => outcome === "completed" || s.fields.some((f) => f.key === "remarks" || f.key === "conclusion"))
        .map((section) => (
          <Card key={section.title} className={CONSOLE_CARD}>
            <CardHeader>
              <CardTitle>{section.title}</CardTitle>
              {section.description && <CardDescription>{section.description}</CardDescription>}
            </CardHeader>
            <CardContent>
              <FieldGroup>{section.fields.filter((f) => outcome === "completed" || f.key === "remarks" || f.key === "conclusion").map(renderField)}</FieldGroup>
            </CardContent>
          </Card>
        ))}

      <Card className={CONSOLE_CARD}>
        <CardHeader>
          <CardTitle>Sign-off</CardTitle>
          <CardDescription>You record findings only — the decision is made by head office.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            {outcome === "completed" && (
              <Field data-invalid={!!errors.ack}>
                <FormField label="Customer / site owner present" htmlFor="ack-name" required>
                  <Input id="ack-name" value={ackName} onChange={(e) => setAckName(e.target.value)} placeholder="Name of the person acknowledging" />
                </FormField>
                <Field orientation="horizontal">
                  <Checkbox id="ack" checked={ackConfirmed} onCheckedChange={setAckConfirmed} />
                  <FieldLabel htmlFor="ack" className="font-normal">
                    The customer / site owner confirms the inspection was carried out at this site in their presence.
                  </FieldLabel>
                </Field>
                <FieldError>{errors.ack}</FieldError>
              </Field>
            )}
            <Field orientation="horizontal" data-invalid={!!errors.declared}>
              <Checkbox id="declared" checked={declared} onCheckedChange={setDeclared} aria-invalid={!!errors.declared} />
              <FieldContent>
                <FieldLabel htmlFor="declared" className="font-normal">
                  I declare that I personally carried out this inspection and the information and photos recorded are true and accurate. I have no conflict of interest with this customer, dealer or site.
                </FieldLabel>
                <FieldError>{errors.declared}</FieldError>
              </FieldContent>
            </Field>
            {errors.form && <FieldError>{errors.form}</FieldError>}
          </FieldGroup>
        </CardContent>
        <CardFooter>
          <Button type="submit" size="lg" className="h-11 w-full sm:w-auto" disabled={pending}>
            {pending && <Spinner data-icon="inline-start" />}
            {outcome === "completed" ? "Submit inspection" : "Record revisit"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}
