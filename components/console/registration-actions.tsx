"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { IconCheck, IconClipboardCheck, IconListCheck, IconMessageQuestion, IconUserPlus, IconX } from "@tabler/icons-react"

import {
  approveRegistration,
  assignInspector,
  decideInspection,
  rejectRegistration,
  requestInfo,
  saveVerification,
  startVerification,
} from "@/app/console/(app)/registrations/actions"
import { ActionBar, ActionDrawer } from "@/components/console/action-drawer"
import { doneFiles, FileUploader, isUploading, type UploadItem } from "@/components/file-uploader"
import { FormField } from "@/components/form-field"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldContent, FieldDescription, FieldLabel, FieldTitle } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { INFO_REQUEST_ITEMS, VERIFICATION_CHECKS, type Role, type VerificationResult } from "@/lib/domain/constants"

type Option = { value: string; label: string }
type Checks = Partial<Record<string, VerificationResult>>

type Props = {
  id: string
  status: string
  roles: Role[]
  inspectors: Option[]
  rejectReasons: Option[]
  noInspectionReasons: Option[]
  /** Saved verification, or the system's suggestions when none is saved yet. */
  checks: Checks
  verified: boolean
}

const APPROVAL_STAGE = ["pending_approval", "inspection_completed"]
const can = (roles: Role[], allowed: Role[]) => roles.includes("admin") || allowed.some((r) => roles.includes(r))

/**
 * Buttons for the registration workflow. Each step belongs to the person the brief gives it to: the backend
 * executive verifies, asks for information, decides on inspection and assigns the inspector; the authorised
 * approver approves or rejects.
 */
export function RegistrationActions({ id, status, roles, inspectors, rejectReasons, noInspectionReasons, checks, verified }: Props) {
  const router = useRouter()
  const started = useRef(false)
  const backend = can(roles, ["verifier"])
  const approver = can(roles, ["approver"])

  // Brief §3: opening a new submission moves it to Under Verification (and tells the customer).
  useEffect(() => {
    if (status !== "received" || !backend || started.current) return
    started.current = true
    startVerification(id).then((r) => {
      if (r.ok) {
        toast.info("Moved to Under Verification")
        router.refresh()
      }
    })
  }, [id, status, backend, router])

  if (["active", "rejected", "not_applicable"].includes(status)) return null
  const atApproval = APPROVAL_STAGE.includes(status)

  return (
    <ActionBar>
      {backend && status === "under_verification" && <Verify id={id} initial={checks} saved={verified} />}
      {backend && status === "under_verification" && verified && <InspectionDecision id={id} reasons={noInspectionReasons} />}
      {backend && ["inspection_required", "inspector_assigned"].includes(status) && (
        <AssignInspector id={id} inspectors={inspectors} reassign={status === "inspector_assigned"} />
      )}
      {approver && atApproval && <Approve id={id} />}
      {((backend && status === "under_verification") || (approver && atApproval)) && <RequestInfo id={id} />}
      {approver && atApproval && <Reject id={id} reasons={rejectReasons} />}
      {status === "info_required" && <p className="self-center text-sm text-muted-foreground">Waiting for the customer to upload the requested information.</p>}
    </ActionBar>
  )
}

function Verify({ id, initial, saved }: { id: string; initial: Checks; saved: boolean }) {
  const [checks, setChecks] = useState<Checks>(initial)
  const [remarks, setRemarks] = useState("")
  const issues = VERIFICATION_CHECKS.filter((c) => checks[c.key] === "issue").length
  return (
    <ActionDrawer
      trigger={<Button variant={saved ? "outline" : "default"} className="flex-1 sm:flex-none" />}
      title="Backend verification"
      description="Check each item against the invoice, documents and photos. Your name is recorded with the verification."
      submitLabel="Save verification"
      success="Verification recorded"
      run={() => saveVerification(id, checks as Record<string, VerificationResult>, remarks)}
      label={<><IconListCheck data-icon="inline-start" />{saved ? "Update verification" : "Verify"}</>}
    >
      <div className="flex flex-col gap-4">
        {VERIFICATION_CHECKS.map((c) => (
          <Field key={c.key}>
            <FieldLabel>{c.label}</FieldLabel>
            <ToggleGroup
              variant="outline"
              spacing={2}
              value={checks[c.key] ? [checks[c.key]!] : []}
              onValueChange={(v) => setChecks((prev) => ({ ...prev, [c.key]: (v as VerificationResult[])[0] }))}
              className="w-full"
            >
              <ToggleGroupItem value="ok" className="h-10 flex-1">
                OK
              </ToggleGroupItem>
              <ToggleGroupItem value="issue" className="h-10 flex-1">
                Issue
              </ToggleGroupItem>
            </ToggleGroup>
          </Field>
        ))}
      </div>
      <FormField
        label="Remarks"
        htmlFor="verify-remarks"
        required={issues > 0}
        description={issues > 0 ? "Describe the issues. If they can be corrected, request additional information next." : undefined}
      >
        <Textarea id="verify-remarks" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
      </FormField>
    </ActionDrawer>
  )
}

function InspectionDecision({ id, reasons }: { id: string; reasons: Option[] }) {
  const [needed, setNeeded] = useState<"yes" | "no" | "">("")
  const [reason, setReason] = useState("")
  const [remarks, setRemarks] = useState("")
  return (
    <ActionDrawer
      trigger={<Button className="flex-1 sm:flex-none" />}
      title="Is site inspection required?"
      description="This selection is mandatory. If no, the registration goes to the authorised approver."
      submitLabel="Save decision"
      success="Decision saved"
      run={async () => {
        if (!needed) return { ok: false, error: "Choose Yes or No." }
        return decideInspection(id, needed === "yes", reason, remarks)
      }}
      label={<><IconClipboardCheck data-icon="inline-start" />Inspection required?</>}
    >
      <RadioGroup value={needed} onValueChange={(v) => setNeeded(v as "yes" | "no")} className="grid grid-cols-2 gap-3">
        {(["yes", "no"] as const).map((v) => (
          <FieldLabel key={v} htmlFor={`insp-${v}`}>
            <Field orientation="horizontal">
              <FieldContent>
                <FieldTitle>{v === "yes" ? "Yes" : "No"}</FieldTitle>
                <FieldDescription>{v === "yes" ? "Assign a site inspector" : "Send for approval"}</FieldDescription>
              </FieldContent>
              <RadioGroupItem value={v} id={`insp-${v}`} />
            </Field>
          </FieldLabel>
        ))}
      </RadioGroup>
      {needed === "no" && (
        <FormField label="Reason inspection is not required" htmlFor="no-insp-reason" required>
          <Select value={reason || null} onValueChange={(v) => setReason((v as string) ?? "")} items={reasons}>
            <SelectTrigger id="no-insp-reason" className="w-full">
              <SelectValue placeholder="Choose a reason" />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {reasons.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      )}
      <FormField label={needed === "yes" ? "What should the inspector check?" : "Remarks"} htmlFor="insp-remarks">
        <Textarea id="insp-remarks" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
      </FormField>
    </ActionDrawer>
  )
}

function AssignInspector({ id, inspectors, reassign }: { id: string; inspectors: Option[]; reassign: boolean }) {
  const [inspector, setInspector] = useState("")
  const [when, setWhen] = useState("")
  return (
    <ActionDrawer
      trigger={<Button variant={reassign ? "outline" : "default"} className="flex-1 sm:flex-none" />}
      title={reassign ? "Reassign or reschedule" : "Assign a site inspector"}
      description="The inspector is emailed the WRN, customer and site details and the inspection form link. The customer is informed. Maximum 48 working hours from submission."
      submitLabel={reassign ? "Update inspection" : "Assign inspector"}
      success="Inspector assigned"
      run={async () => {
        if (!inspector) return { ok: false, error: "Choose an inspector." }
        return assignInspector(id, inspector, when ? new Date(when).toISOString() : null)
      }}
      label={<><IconUserPlus data-icon="inline-start" />{reassign ? "Reassign inspector" : "Assign inspector"}</>}
    >
      <FormField label="Inspector" htmlFor="inspector" required>
        <Select value={inspector || null} onValueChange={(v) => setInspector((v as string) ?? "")} items={inspectors}>
          <SelectTrigger id="inspector" className="w-full">
            <SelectValue placeholder="Choose an inspector" />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            {inspectors.map((i) => (
              <SelectItem key={i.value} value={i.value}>
                {i.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
      <FormField label="Visit date and time" htmlFor="visit-at" description="Optional. Set it once the visit is agreed with the customer.">
        <Input id="visit-at" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
      </FormField>
    </ActionDrawer>
  )
}

function Evidence({ id, files, setFiles }: { id: string; files: UploadItem[]; setFiles: React.Dispatch<React.SetStateAction<UploadItem[]>> }) {
  return (
    <FormField label="Supporting photograph / document" htmlFor={id} description="Where relevant.">
      <FileUploader id={id} kind="decision_evidence" items={files} setItems={(fn) => setFiles(fn)} max={5} label="Attach file" />
    </FormField>
  )
}

function Approve({ id }: { id: string }) {
  const [remarks, setRemarks] = useState("")
  const [files, setFiles] = useState<UploadItem[]>([])
  return (
    <ActionDrawer
      trigger={<Button className="flex-1 sm:flex-none" />}
      title="Approve registration"
      description="Status moves to Approved. The system then activates the warranty, generates the certificate and emails it to the site owner."
      submitLabel="Approve"
      success="Approved — warranty active and certificate emailed"
      run={async () => {
        if (isUploading(files)) return { ok: false, error: "Wait for the upload to finish." }
        return approveRegistration(id, remarks, doneFiles(files))
      }}
      label={<><IconCheck data-icon="inline-start" />Approve</>}
    >
      <FormField label="Remarks" htmlFor="approve-remarks" required description="Mandatory for every decision. Your name, user ID and the time are recorded.">
        <Textarea id="approve-remarks" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
      </FormField>
      <Evidence id="approve-files" files={files} setFiles={setFiles} />
    </ActionDrawer>
  )
}

function RequestInfo({ id }: { id: string }) {
  const [items, setItems] = useState<string[]>([])
  const [remarks, setRemarks] = useState("")
  return (
    <ActionDrawer
      trigger={<Button variant="outline" className="flex-1 sm:flex-none" />}
      title="Additional information required"
      description="The customer is sent an automated request and uploads the information through the portal. The registration then returns to Under Verification."
      submitLabel="Send request"
      success="Request sent to the customer"
      run={() => requestInfo(id, items, remarks)}
      label={<><IconMessageQuestion data-icon="inline-start" />Request info</>}
    >
      <div className="flex flex-col gap-3">
        {INFO_REQUEST_ITEMS.map((item) => (
          <Field key={item} orientation="horizontal">
            <Checkbox
              id={`req-${item}`}
              checked={items.includes(item)}
              onCheckedChange={(c) => setItems((prev) => (c ? [...prev, item] : prev.filter((x) => x !== item)))}
            />
            <FieldLabel htmlFor={`req-${item}`} className="font-normal">
              {item}
            </FieldLabel>
          </Field>
        ))}
      </div>
      <FormField label="Remarks explaining what is required" htmlFor="req-remarks" required>
        <Textarea id="req-remarks" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="e.g. The invoice photo is blurred — please upload a clear copy." />
      </FormField>
    </ActionDrawer>
  )
}

function Reject({ id, reasons }: { id: string; reasons: Option[] }) {
  const [reason, setReason] = useState("")
  const [remarks, setRemarks] = useState("")
  const [files, setFiles] = useState<UploadItem[]>([])
  return (
    <ActionDrawer
      trigger={<Button variant="destructive" className="flex-1 sm:flex-none" />}
      title="Reject SylvanCare+ registration"
      description="If the issue can be corrected, use Request info instead. The standard warranty is not affected."
      submitLabel="Reject registration"
      destructive
      success="Registration rejected and customer informed"
      run={async () => {
        if (isUploading(files)) return { ok: false, error: "Wait for the upload to finish." }
        return rejectRegistration(id, reason, remarks, doneFiles(files))
      }}
      label={<><IconX data-icon="inline-start" />Reject</>}
    >
      <FormField label="Rejection reason" htmlFor="reject-reason" required>
        <Select value={reason || null} onValueChange={(v) => setReason((v as string) ?? "")} items={reasons}>
          <SelectTrigger id="reject-reason" className="w-full">
            <SelectValue placeholder="Choose a reason" />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            {reasons.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
      <FormField label="Detailed remarks" htmlFor="reject-remarks" required>
        <Textarea id="reject-remarks" rows={4} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
      </FormField>
      <Evidence id="reject-files" files={files} setFiles={setFiles} />
    </ActionDrawer>
  )
}
