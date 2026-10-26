"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  IconCheck,
  IconClipboardCheck,
  IconFlask,
  IconGavel,
  IconLock,
  IconMessageQuestion,
  IconTestPipe,
  IconTruckDelivery,
  IconUserPlus,
  IconX,
} from "@tabler/icons-react"

import {
  addCustodyEvent,
  addLabReport,
  approveCompensation,
  assignClaimInspector,
  closeClaim,
  completeSettlement,
  decideClaim,
  financeApprove,
  recordSample,
  requestClaimInfo,
  saveCompensation,
  saveScreening,
  startScreening,
  startTechnicalReview,
  updateSettlement,
} from "@/app/console/(app)/claims/actions"
import { ActionDrawer } from "@/components/console/action-drawer"
import { doneFiles, FileUploader, type UploadItem } from "@/components/file-uploader"
import { FormField } from "@/components/form-field"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldTitle } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { COMPENSATION_LINES, payable, SCREENING_CHECKS, SETTLEMENT_MODES } from "@/lib/domain/compensation"
import { INFO_REQUEST_ITEMS, LABS } from "@/lib/domain/constants"
import { formatINR } from "@/lib/domain/format"

type Option = { value: string; label: string }
type Result = { ok: true } | { ok: false; error: string }

function OptionSelect({ id, value, onChange, options, placeholder }: { id: string; value: string; onChange: (v: string) => void; options: readonly Option[]; placeholder: string }) {
  return (
    <Select value={value || null} onValueChange={(v) => onChange((v as string) ?? "")} items={options}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** Brief: opening a new complaint starts pre-screening. */
export function AutoStartScreening({ id, active }: { id: string; active: boolean }) {
  const router = useRouter()
  const started = useRef(false)
  useEffect(() => {
    if (!active || started.current) return
    started.current = true
    startScreening(id).then((r) => r.ok && router.refresh())
  }, [id, active, router])
  return null
}

export function ScreeningPanel({ id, auto, findings }: { id: string; auto: Record<string, boolean>; findings: Option[] }) {
  const router = useRouter()
  const [checks, setChecks] = useState<Record<string, boolean>>(auto)
  const [reject, setReject] = useState(false)
  const [finding, setFinding] = useState("")
  const [remarks, setRemarks] = useState("")
  const [error, setError] = useState("")
  const [pending, start] = useTransition()
  const allPass = SCREENING_CHECKS.every((c) => checks[c.key])

  const run = (outcome: "inspection" | "reject") =>
    start(async () => {
      setError("")
      const res = await saveScreening(id, checks, outcome, finding, remarks)
      if (!res.ok) return setError(res.error)
      toast.success(outcome === "inspection" ? "Screening passed — assign an inspector next" : "Claim rejected")
      router.refresh()
    })

  return (
    <FieldGroup>
      <div className="flex flex-col gap-3">
        {SCREENING_CHECKS.map((c) => (
          <Field key={c.key} orientation="horizontal">
            <Checkbox id={`scr-${c.key}`} checked={!!checks[c.key]} onCheckedChange={(v) => setChecks((s) => ({ ...s, [c.key]: v }))} />
            <FieldContent>
              <FieldLabel htmlFor={`scr-${c.key}`} className="font-normal">
                {c.label}
              </FieldLabel>
              {c.auto && <FieldDescription>{auto[c.key] ? "Checked automatically" : "Automatic check failed — review"}</FieldDescription>}
            </FieldContent>
          </Field>
        ))}
      </div>
      <FormField label="Screening remarks" htmlFor="scr-remarks">
        <Textarea id="scr-remarks" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
      </FormField>
      {reject && (
        <FormField label="Reason for immediate rejection" htmlFor="scr-finding" required>
          <OptionSelect id="scr-finding" value={finding} onChange={setFinding} options={findings} placeholder="Choose a reason" />
        </FormField>
      )}
      <FieldError>{error}</FieldError>
      <div className="flex flex-wrap gap-2">
        <Button className="h-10 flex-1 sm:flex-none" disabled={pending || !allPass} onClick={() => run("inspection")}>
          {pending ? <Spinner data-icon="inline-start" /> : <IconClipboardCheck data-icon="inline-start" />}
          Proceed to inspection
        </Button>
        {!reject ? (
          <Button variant="destructive" className="h-10 flex-1 sm:flex-none" onClick={() => setReject(true)}>
            <IconX data-icon="inline-start" />
            Reject
          </Button>
        ) : (
          <Button variant="destructive" className="h-10 flex-1 sm:flex-none" disabled={pending} onClick={() => run("reject")}>
            Confirm rejection
          </Button>
        )}
        <ClaimInfoRequest id={id} />
      </div>
    </FieldGroup>
  )
}

export function ClaimInfoRequest({ id }: { id: string }) {
  const [items, setItems] = useState<string[]>([])
  const [remarks, setRemarks] = useState("")
  return (
    <ActionDrawer
      trigger={<Button variant="outline" className="h-10 flex-1 sm:flex-none" />}
      label={<><IconMessageQuestion data-icon="inline-start" />Request info</>}
      title="Request more information"
      submitLabel="Send request"
      success="Request sent"
      run={() => requestClaimInfo(id, items, remarks)}
    >
      {INFO_REQUEST_ITEMS.map((item) => (
        <Field key={item} orientation="horizontal">
          <Checkbox id={`creq-${item}`} checked={items.includes(item)} onCheckedChange={(c) => setItems((p) => (c ? [...p, item] : p.filter((x) => x !== item)))} />
          <FieldLabel htmlFor={`creq-${item}`} className="font-normal">
            {item}
          </FieldLabel>
        </Field>
      ))}
      <FormField label="Remarks for the customer" htmlFor="creq-remarks" required>
        <Textarea id="creq-remarks" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
      </FormField>
    </ActionDrawer>
  )
}

export function AssignClaimInspector({ id, inspectors, reassign }: { id: string; inspectors: Option[]; reassign: boolean }) {
  const [inspector, setInspector] = useState("")
  const [when, setWhen] = useState("")
  return (
    <ActionDrawer
      trigger={<Button variant={reassign ? "outline" : "default"} className="h-10" />}
      label={<><IconUserPlus data-icon="inline-start" />{reassign ? "Reassign inspector" : "Assign inspector"}</>}
      title="Assign a site inspector"
      submitLabel="Assign"
      success="Inspector assigned"
      run={async () => (inspector ? assignClaimInspector(id, inspector, when ? new Date(when).toISOString() : null) : { ok: false, error: "Choose an inspector." })}
    >
      <FormField label="Inspector" htmlFor="c-insp" required>
        <OptionSelect id="c-insp" value={inspector} onChange={setInspector} options={inspectors} placeholder="Choose an inspector" />
      </FormField>
      <FormField label="Visit date and time" htmlFor="c-when">
        <Input id="c-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
      </FormField>
    </ActionDrawer>
  )
}

export function SimpleAction({ label, icon, run, confirm, variant = "default" }: { label: string; icon: "review" | "close" | "complete"; run: () => Promise<Result>; confirm?: string; variant?: "default" | "outline" }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const Icon = icon === "review" ? IconGavel : icon === "close" ? IconLock : IconCheck
  return (
    <Button
      variant={variant}
      className="h-10"
      disabled={pending}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return
        start(async () => {
          const res = await run()
          if (!res.ok) return void toast.error(res.error)
          toast.success("Done")
          router.refresh()
        })
      }}
    >
      {pending ? <Spinner data-icon="inline-start" /> : <Icon data-icon="inline-start" />}
      {label}
    </Button>
  )
}

export function StartTechnicalReview({ id }: { id: string }) {
  return <SimpleAction label="Start technical review" icon="review" run={() => startTechnicalReview(id)} />
}

export function SampleForm({ id }: { id: string }) {
  const [form, setForm] = useState({ seal_no: "", description: "", collected_at: "", customer_ack: false })
  return (
    <ActionDrawer
      trigger={<Button variant="outline" className="h-10" />}
      label={<><IconTestPipe data-icon="inline-start" />Record sample</>}
      title="Record a sample"
      description="Seal the sample at site and note the seal number. Chain of custody starts here."
      submitLabel="Save sample"
      success="Sample recorded"
      run={() => recordSample(id, { ...form, collected_at: form.collected_at ? new Date(form.collected_at).toISOString() : "" })}
    >
      <FormField label="Seal / sample number" htmlFor="s-seal" required>
        <Input id="s-seal" value={form.seal_no} onChange={(e) => setForm({ ...form, seal_no: e.target.value })} />
      </FormField>
      <FormField label="What was extracted, and from where" htmlFor="s-desc" required>
        <Textarea id="s-desc" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </FormField>
      <FormField label="Collected at" htmlFor="s-at" required>
        <Input id="s-at" type="datetime-local" value={form.collected_at} onChange={(e) => setForm({ ...form, collected_at: e.target.value })} />
      </FormField>
      <Field orientation="horizontal">
        <Checkbox id="s-ack" checked={form.customer_ack} onCheckedChange={(c) => setForm({ ...form, customer_ack: c })} />
        <FieldLabel htmlFor="s-ack" className="font-normal">
          Customer acknowledged the sample collection
        </FieldLabel>
      </Field>
    </ActionDrawer>
  )
}

export function CustodyForm({ sampleId }: { sampleId: string }) {
  const [form, setForm] = useState({ event: "", location: "", handled_by: "", at: "" })
  return (
    <ActionDrawer
      trigger={<Button variant="ghost" size="sm" />}
      label="Add custody step"
      title="Chain of custody"
      submitLabel="Add step"
      success="Custody step added"
      run={() => addCustodyEvent(sampleId, { ...form, at: form.at ? new Date(form.at).toISOString() : "" })}
    >
      <FormField label="Event" htmlFor="ce-event" required>
        <Input id="ce-event" placeholder="e.g. Handed to courier / Received at lab" value={form.event} onChange={(e) => setForm({ ...form, event: e.target.value })} />
      </FormField>
      <FormField label="Location" htmlFor="ce-loc" required>
        <Input id="ce-loc" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
      </FormField>
      <FormField label="Handled by" htmlFor="ce-by" required>
        <Input id="ce-by" value={form.handled_by} onChange={(e) => setForm({ ...form, handled_by: e.target.value })} />
      </FormField>
      <FormField label="When" htmlFor="ce-at" required>
        <Input id="ce-at" type="datetime-local" value={form.at} onChange={(e) => setForm({ ...form, at: e.target.value })} />
      </FormField>
    </ActionDrawer>
  )
}

export function LabReportForm({ id, samples }: { id: string; samples: Option[] }) {
  const [form, setForm] = useState({ sample_id: "", lab_name: "", report_no: "", report_date: "", result: "", summary: "" })
  const [files, setFiles] = useState<UploadItem[]>([])
  const results: Option[] = [
    { value: "defect_confirmed", label: "Manufacturing defect confirmed" },
    { value: "no_defect", label: "No manufacturing defect" },
    { value: "inconclusive", label: "Inconclusive" },
  ]
  return (
    <ActionDrawer
      trigger={<Button variant="outline" className="h-10" />}
      label={<><IconFlask data-icon="inline-start" />Add lab report</>}
      title="Laboratory test report"
      submitLabel="Save report"
      success="Lab report saved"
      run={() => addLabReport(id, { ...form, files: doneFiles(files) })}
    >
      {samples.length > 0 && (
        <FormField label="Sample" htmlFor="lr-sample">
          <OptionSelect id="lr-sample" value={form.sample_id} onChange={(v) => setForm({ ...form, sample_id: v })} options={samples} placeholder="Choose sample" />
        </FormField>
      )}
      <FormField label="Laboratory" htmlFor="lr-lab" required>
        <OptionSelect id="lr-lab" value={form.lab_name} onChange={(v) => setForm({ ...form, lab_name: v })} options={LABS.map((l) => ({ value: l, label: l }))} placeholder="Choose lab" />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Report no." htmlFor="lr-no">
          <Input id="lr-no" value={form.report_no} onChange={(e) => setForm({ ...form, report_no: e.target.value })} />
        </FormField>
        <FormField label="Report date" htmlFor="lr-date" required>
          <Input id="lr-date" type="date" value={form.report_date} onChange={(e) => setForm({ ...form, report_date: e.target.value })} />
        </FormField>
      </div>
      <FormField label="Result" htmlFor="lr-result" required>
        <OptionSelect id="lr-result" value={form.result} onChange={(v) => setForm({ ...form, result: v })} options={results} placeholder="Choose result" />
      </FormField>
      <FormField label="Summary" htmlFor="lr-summary" required>
        <Textarea id="lr-summary" rows={3} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
      </FormField>
      <FormField label="Report file" htmlFor="lr-file">
        <FileUploader id="lr-file" kind="lab_report" items={files} setItems={(fn) => setFiles(fn)} max={1} label="Attach report" />
      </FormField>
    </ActionDrawer>
  )
}

export function DecisionDrawer({ id, findings, maxQty }: { id: string; findings: Option[]; maxQty: number }) {
  const [decision, setDecision] = useState<"approved" | "partially_approved" | "rejected" | "">("")
  const [finding, setFinding] = useState("")
  const [qty, setQty] = useState("")
  const [remarks, setRemarks] = useState("")
  return (
    <ActionDrawer
      trigger={<Button className="h-10" />}
      label={<><IconGavel data-icon="inline-start" />Technical decision</>}
      title="Technical decision (HO)"
      description="The inspector records findings; this decision rests with HO technical. Remarks are mandatory."
      submitLabel="Record decision"
      success="Decision recorded and customer informed"
      run={async () => (decision ? decideClaim(id, decision, finding, qty, remarks) : { ok: false, error: "Choose a decision." })}
    >
      <RadioGroup value={decision} onValueChange={(v) => setDecision(v as typeof decision)} className="grid gap-2">
        {[
          { v: "approved", t: "Approve", d: "Defect is covered" },
          { v: "partially_approved", t: "Partially approve", d: "Only part of the claim is covered" },
          { v: "rejected", t: "Reject", d: "Not covered under the policy" },
        ].map((o) => (
          <FieldLabel key={o.v} htmlFor={`dec-${o.v}`}>
            <Field orientation="horizontal">
              <FieldContent>
                <FieldTitle>{o.t}</FieldTitle>
                <FieldDescription>{o.d}</FieldDescription>
              </FieldContent>
              <RadioGroupItem value={o.v} id={`dec-${o.v}`} />
            </Field>
          </FieldLabel>
        ))}
      </RadioGroup>
      <FormField label="Technical finding" htmlFor="dec-finding" required>
        <OptionSelect id="dec-finding" value={finding} onChange={setFinding} options={findings} placeholder="Choose finding" />
      </FormField>
      {decision && decision !== "rejected" && (
        <FormField label="Approved defective quantity" htmlFor="dec-qty" required description={`Up to ${maxQty} sheets claimed`}>
          <Input id="dec-qty" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} />
        </FormField>
      )}
      <FormField label="HO technical remarks" htmlFor="dec-remarks" required>
        <Textarea id="dec-remarks" rows={4} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
      </FormField>
    </ActionDrawer>
  )
}

type Line = { key: string; claimed: number | null; estimate: number | null }

export function CompensationEditor({ id, initial }: { id: string; initial: Line[] }) {
  const router = useRouter()
  const [rows, setRows] = useState(() =>
    COMPENSATION_LINES.map((l) => {
      const found = initial.find((i) => i.key === l.key)
      return { key: l.key, label: l.label, claimed: found?.claimed?.toString() ?? "", estimate: found?.estimate?.toString() ?? "" }
    })
  )
  const [error, setError] = useState("")
  const [pending, start] = useTransition()
  const num = (v: string) => (v === "" ? null : Number(v))
  const total = rows.reduce((s, r) => s + payable(num(r.claimed), num(r.estimate)), 0)
  const set = (key: string, field: "claimed" | "estimate", v: string) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [field]: v.replace(/[^\d.]/g, "") } : r)))

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">Policy 5.4: each item is paid at the lower of the claimant&apos;s invoice and Sylvan&apos;s internal estimate. Leave items blank if not applicable.</p>
      <div className="flex flex-col gap-3 md:hidden">
        {rows.map((r) => (
          <div key={r.key} className="flex flex-col gap-2 rounded-lg border p-3">
            <p className="text-sm font-medium">{r.label}</p>
            <div className="grid grid-cols-2 gap-2">
              <InputGroup>
                <InputGroupAddon><InputGroupText>Claimed ₹</InputGroupText></InputGroupAddon>
                <InputGroupInput inputMode="decimal" value={r.claimed} onChange={(e) => set(r.key, "claimed", e.target.value)} />
              </InputGroup>
              <InputGroup>
                <InputGroupAddon><InputGroupText>Est. ₹</InputGroupText></InputGroupAddon>
                <InputGroupInput inputMode="decimal" value={r.estimate} onChange={(e) => set(r.key, "estimate", e.target.value)} />
              </InputGroup>
            </div>
            <p className="text-right text-sm">Payable {formatINR(payable(num(r.claimed), num(r.estimate)))}</p>
          </div>
        ))}
      </div>
      <Table className="hidden md:table">
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead>Claimed (invoice) ₹</TableHead>
            <TableHead>Internal estimate ₹</TableHead>
            <TableHead className="text-right">Payable</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.key}>
              <TableCell>{r.label}</TableCell>
              <TableCell><Input inputMode="decimal" value={r.claimed} onChange={(e) => set(r.key, "claimed", e.target.value)} /></TableCell>
              <TableCell><Input inputMode="decimal" value={r.estimate} onChange={(e) => set(r.key, "estimate", e.target.value)} /></TableCell>
              <TableCell className="text-right tabular-nums">{formatINR(payable(num(r.claimed), num(r.estimate)))}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={3}>Total payable</TableCell>
            <TableCell className="text-right font-semibold tabular-nums">{formatINR(total)}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
      <p className="text-right font-semibold md:hidden">Total payable {formatINR(total)}</p>
      <FieldError>{error}</FieldError>
      <Button
        className="h-10 w-full sm:w-fit"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError("")
            const res = await saveCompensation(id, rows)
            if (!res.ok) return setError(res.error)
            toast.success("Compensation sheet saved")
            router.refresh()
          })
        }
      >
        {pending && <Spinner data-icon="inline-start" />}
        Save compensation sheet
      </Button>
    </div>
  )
}

export function ApproveCompensation({ id }: { id: string }) {
  return <SimpleAction label="Approve compensation" icon="complete" run={() => approveCompensation(id)} confirm="Approve this compensation sheet?" />
}

export function FinanceApprove({ id }: { id: string }) {
  const [mode, setMode] = useState("")
  return (
    <ActionDrawer
      trigger={<Button className="h-10" />}
      label={<><IconCheck data-icon="inline-start" />Finance approval</>}
      title="Finance approval"
      description="Approves the compensation and starts the settlement."
      submitLabel="Approve and start settlement"
      success="Settlement started"
      run={() => financeApprove(id, mode)}
    >
      <FormField label="Settlement mode" htmlFor="fin-mode" required>
        <OptionSelect id="fin-mode" value={mode} onChange={setMode} options={SETTLEMENT_MODES} placeholder="Choose how to settle" />
      </FormField>
    </ActionDrawer>
  )
}

export function SettlementForm({
  id,
  initial,
}: {
  id: string
  initial: { bank_verified: boolean; bank_reference: string; replacement_details: string; payment_reference: string; customer_accepted: boolean; restoration_confirmed: boolean; notes: string }
}) {
  const router = useRouter()
  const [form, setForm] = useState(initial)
  const [files, setFiles] = useState<UploadItem[]>([])
  const [error, setError] = useState("")
  const [pending, start] = useTransition()
  const toggle = (key: "bank_verified" | "customer_accepted" | "restoration_confirmed", label: string) => (
    <Field orientation="horizontal">
      <Switch id={`st-${key}`} checked={form[key]} onCheckedChange={(v) => setForm({ ...form, [key]: v })} />
      <FieldLabel htmlFor={`st-${key}`} className="font-normal">
        {label}
      </FieldLabel>
    </Field>
  )
  return (
    <FieldGroup>
      {toggle("bank_verified", "Customer bank details verified (for reimbursement)")}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Bank reference" htmlFor="st-bank" description="Last 4 digits or verification ref — never full details">
          <Input id="st-bank" value={form.bank_reference} onChange={(e) => setForm({ ...form, bank_reference: e.target.value })} />
        </FormField>
        <FormField label="Payment / UTR reference" htmlFor="st-pay">
          <Input id="st-pay" value={form.payment_reference} onChange={(e) => setForm({ ...form, payment_reference: e.target.value })} />
        </FormField>
      </div>
      <FormField label="Replacement material / labour arranged" htmlFor="st-repl">
        <Textarea id="st-repl" rows={2} value={form.replacement_details} onChange={(e) => setForm({ ...form, replacement_details: e.target.value })} />
      </FormField>
      {toggle("customer_accepted", "Customer accepted the settlement")}
      {toggle("restoration_confirmed", "Restoration completed and confirmed")}
      <FormField label="Before and after photos" htmlFor="st-photos">
        <FileUploader id="st-photos" kind="settlement_photo" items={files} setItems={(fn) => setFiles(fn)} label="Add photos" capture />
      </FormField>
      <FormField label="Notes" htmlFor="st-notes">
        <Textarea id="st-notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </FormField>
      <FieldError>{error}</FieldError>
      <Button
        variant="outline"
        className="h-10 w-full sm:w-fit"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError("")
            const res = await updateSettlement(id, { ...form, files: doneFiles(files) })
            if (!res.ok) return setError(res.error)
            setFiles([])
            toast.success("Settlement updated")
            router.refresh()
          })
        }
      >
        <IconTruckDelivery data-icon="inline-start" />
        Save settlement progress
      </Button>
    </FieldGroup>
  )
}

export function CompleteSettlement({ id }: { id: string }) {
  return <SimpleAction label="Mark settlement complete" icon="complete" run={() => completeSettlement(id)} />
}

export function CloseClaim({ id }: { id: string }) {
  return <SimpleAction label="Close claim and issue certificate" icon="close" run={() => closeClaim(id)} confirm="Close this claim? The compensated quantity will be recorded as used." />
}
