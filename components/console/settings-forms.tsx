"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { IconFileImport, IconKey, IconPencil, IconPlus, IconTrash } from "@tabler/icons-react"

import {
  addHoliday,
  createStaff,
  importDealers,
  removeHoliday,
  resetStaffPassword,
  saveDealer,
  updateGeneral,
  updateProduct,
  updateStaff,
  type DealerInput,
  type GeneralInput,
} from "@/app/console/(app)/settings/actions"
import { ActionDrawer } from "@/components/console/action-drawer"
import { FormField } from "@/components/form-field"
import { PhoneInput } from "@/components/phone-input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ROLE_LABELS, ROLES } from "@/lib/domain/constants"

type Option = { value: string; label: string }

function RoleChecks({ roles, setRoles }: { roles: string[]; setRoles: (r: string[]) => void }) {
  return (
    <Field>
      <FieldLabel>Roles</FieldLabel>
      <div className="grid grid-cols-2 gap-2">
        {ROLES.map((r) => (
          <Field key={r} orientation="horizontal">
            <Checkbox id={`role-${r}`} checked={roles.includes(r)} onCheckedChange={(c) => setRoles(c ? [...roles, r] : roles.filter((x) => x !== r))} />
            <FieldLabel htmlFor={`role-${r}`} className="font-normal">
              {ROLE_LABELS[r]}
            </FieldLabel>
          </Field>
        ))}
      </div>
    </Field>
  )
}

function PasswordNotice({ password, onClose }: { password: string; onClose: () => void }) {
  return (
    <Alert>
      <IconKey />
      <AlertTitle>Temporary password: <span className="font-mono">{password}</span></AlertTitle>
      <AlertDescription>
        Share it with the person directly. It isn&apos;t emailed or shown again.
        <Button variant="link" className="h-auto p-0" onClick={onClose}>
          Done
        </Button>
      </AlertDescription>
    </Alert>
  )
}

export function StaffCreate() {
  const [form, setForm] = useState({ full_name: "", email: "", designation: "", roles: [] as string[], regions: "" })
  const [password, setPassword] = useState("")
  return (
    <>
      {password && <PasswordNotice password={password} onClose={() => setPassword("")} />}
      <ActionDrawer
        trigger={<Button />}
        label={<><IconPlus data-icon="inline-start" />Add staff</>}
        title="Add a staff member"
        description="They log in at /console with their email and a temporary password."
        submitLabel="Create account"
        success="Account created"
        run={async () => {
          const res = await createStaff(form)
          if (res.ok && res.password) {
            setPassword(res.password)
            setForm({ full_name: "", email: "", designation: "", roles: [], regions: "" })
          }
          return res
        }}
      >
        <FormField label="Full name" htmlFor="st-name" required>
          <Input id="st-name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        </FormField>
        <FormField label="Work email" htmlFor="st-email" required>
          <Input id="st-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </FormField>
        <FormField label="Designation" htmlFor="st-desig">
          <Input id="st-desig" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
        </FormField>
        <RoleChecks roles={form.roles} setRoles={(roles) => setForm({ ...form, roles })} />
        <FormField label="Regions (states)" htmlFor="st-regions" description="Comma-separated, e.g. West Bengal, Odisha — used to suggest inspectors">
          <Input id="st-regions" value={form.regions} onChange={(e) => setForm({ ...form, regions: e.target.value })} />
        </FormField>
      </ActionDrawer>
    </>
  )
}

export function StaffEdit({ staff }: { staff: { id: string; full_name: string; designation: string | null; roles: string[]; regions: string[]; active: boolean } }) {
  const [form, setForm] = useState({ designation: staff.designation ?? "", roles: staff.roles, regions: staff.regions.join(", "), active: staff.active })
  const [password, setPassword] = useState("")
  const [resetting, start] = useTransition()
  return (
    <ActionDrawer
      trigger={<Button variant="ghost" size="icon-sm" aria-label={`Edit ${staff.full_name}`} />}
      label={<IconPencil />}
      title={staff.full_name}
      submitLabel="Save"
      success="Saved"
      run={() => updateStaff(staff.id, form)}
    >
      {password && <PasswordNotice password={password} onClose={() => setPassword("")} />}
      <FormField label="Designation" htmlFor={`ed-desig-${staff.id}`}>
        <Input id={`ed-desig-${staff.id}`} value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
      </FormField>
      <RoleChecks roles={form.roles} setRoles={(roles) => setForm({ ...form, roles })} />
      <FormField label="Regions" htmlFor={`ed-reg-${staff.id}`}>
        <Input id={`ed-reg-${staff.id}`} value={form.regions} onChange={(e) => setForm({ ...form, regions: e.target.value })} />
      </FormField>
      <Field orientation="horizontal">
        <Switch id={`ed-active-${staff.id}`} checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
        <FieldLabel htmlFor={`ed-active-${staff.id}`} className="font-normal">
          Active (can log in)
        </FieldLabel>
      </Field>
      <Button
        type="button"
        variant="outline"
        disabled={resetting}
        onClick={() =>
          start(async () => {
            const res = await resetStaffPassword(staff.id)
            if (!res.ok) return void toast.error(res.error)
            setPassword(res.password!)
          })
        }
      >
        {resetting ? <Spinner data-icon="inline-start" /> : <IconKey data-icon="inline-start" />}
        Reset password
      </Button>
    </ActionDrawer>
  )
}

export function ProductEdit({ product }: { product: { id: string; name: string; category: string; standard_period: string | null; lifetime_multiplier: string | null; care_plus_years: number | null; coverage_note: string | null; active: boolean } }) {
  const [form, setForm] = useState({
    standard_period: product.standard_period ?? "",
    lifetime_multiplier: product.lifetime_multiplier ?? "",
    care_plus_years: product.care_plus_years?.toString() ?? "",
    coverage_note: product.coverage_note ?? "",
    active: product.active,
  })
  return (
    <ActionDrawer
      trigger={<Button variant="ghost" size="icon-sm" aria-label={`Edit ${product.name}`} />}
      label={<IconPencil />}
      title={`${product.name} — ${product.category.replace("_", " ")}`}
      description="Changes apply to new registrations and certificates. Every change is logged."
      submitLabel="Save product"
      success="Product updated"
      run={() => updateProduct(product.id, form)}
    >
      <FormField label="Standard warranty period" htmlFor={`p-period-${product.id}`} description="Printed on the e-warranty, e.g. Lifetime or 30 years">
        <Input id={`p-period-${product.id}`} value={form.standard_period} onChange={(e) => setForm({ ...form, standard_period: e.target.value })} />
      </FormField>
      <FormField label="Lifetime multiplier" htmlFor={`p-mult-${product.id}`} description="2.5×, 5×, 7.5× or 10× per damaged sheet — pending from Sylvan">
        <Input id={`p-mult-${product.id}`} value={form.lifetime_multiplier} onChange={(e) => setForm({ ...form, lifetime_multiplier: e.target.value })} />
      </FormField>
      <FormField label="SylvanCare+ years" htmlFor={`p-care-${product.id}`} description="Leave empty if not covered by SylvanCare+ (plywood only)">
        <Input id={`p-care-${product.id}`} inputMode="numeric" value={form.care_plus_years} onChange={(e) => setForm({ ...form, care_plus_years: e.target.value.replace(/\D/g, "") })} />
      </FormField>
      <FormField label="Coverage note" htmlFor={`p-note-${product.id}`}>
        <Input id={`p-note-${product.id}`} value={form.coverage_note} onChange={(e) => setForm({ ...form, coverage_note: e.target.value })} />
      </FormField>
      <Field orientation="horizontal">
        <Switch id={`p-active-${product.id}`} checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
        <FieldLabel htmlFor={`p-active-${product.id}`} className="font-normal">
          Available for registration
        </FieldLabel>
      </Field>
    </ActionDrawer>
  )
}

export function DealerEdit({ dealer, coordinators }: { dealer?: DealerInput & { id: string }; coordinators: Option[] }) {
  const [form, setForm] = useState<DealerInput>(dealer ?? { code: "", name: "", city: "", state: "", gstin: "", phone: "", coordinator_id: "", authorised: true, active: true })
  return (
    <ActionDrawer
      trigger={dealer ? <Button variant="ghost" size="icon-sm" aria-label={`Edit ${dealer.name}`} /> : <Button />}
      label={dealer ? <IconPencil /> : <><IconPlus data-icon="inline-start" />Add dealer</>}
      title={dealer ? dealer.name : "Add a dealer"}
      submitLabel="Save dealer"
      success="Dealer saved"
      run={() => saveDealer(form)}
    >
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Dealer code" htmlFor="d-code">
          <Input id="d-code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
        </FormField>
        <FormField label="GSTIN" htmlFor="d-gstin">
          <Input id="d-gstin" className="font-mono uppercase" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase().slice(0, 15) })} />
        </FormField>
      </div>
      <FormField label="Name" htmlFor="d-name" required>
        <Input id="d-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="City" htmlFor="d-city">
          <Input id="d-city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        </FormField>
        <FormField label="State" htmlFor="d-state">
          <Input id="d-state" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
        </FormField>
      </div>
      <FormField label="Phone" htmlFor="d-phone">
        <PhoneInput id="d-phone" value={form.phone} onValueChange={(v) => setForm({ ...form, phone: v })} />
      </FormField>
      <FormField label="Sales coordinator" htmlFor="d-coord" description="Reviews and issues this dealer's e-warranties">
        <Select value={form.coordinator_id || null} onValueChange={(v) => setForm({ ...form, coordinator_id: (v as string) ?? "" })} items={coordinators}>
          <SelectTrigger id="d-coord" className="w-full">
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
      <Field orientation="horizontal">
        <Switch id="d-auth" checked={form.authorised} onCheckedChange={(v) => setForm({ ...form, authorised: v })} />
        <FieldLabel htmlFor="d-auth" className="font-normal">
          Authorised dealer
        </FieldLabel>
      </Field>
      <Field orientation="horizontal">
        <Switch id="d-active" checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
        <FieldLabel htmlFor="d-active" className="font-normal">
          Show in the registration form
        </FieldLabel>
      </Field>
    </ActionDrawer>
  )
}

export function DealerImport() {
  const [text, setText] = useState("")
  return (
    <ActionDrawer
      trigger={<Button variant="outline" />}
      label={<><IconFileImport data-icon="inline-start" />Import list</>}
      title="Import dealers"
      description="Paste rows from Excel as CSV: code, name, city, state, GSTIN, phone, coordinator email. Existing codes are updated."
      submitLabel="Import"
      success="Import finished"
      run={async () => {
        const res = await importDealers(text)
        if (res.ok && res.summary) toast.info(res.summary)
        return res
      }}
    >
      <Textarea rows={10} className="font-mono text-xs" placeholder={"code,name,city,state,gstin,phone,coordinator_email\nDLR-001,Shree Plywood,Kolkata,West Bengal,19ABCDE1234F1Z5,9830000000,coordinator@example.com"} value={text} onChange={(e) => setText(e.target.value)} />
    </ActionDrawer>
  )
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export function GeneralForm({ initial }: { initial: GeneralInput }) {
  const router = useRouter()
  const [form, setForm] = useState(initial)
  const [error, setError] = useState("")
  const [pending, start] = useTransition()
  const num = (k: keyof GeneralInput, label: string, help?: string) => (
    <FormField label={label} htmlFor={`g-${k}`} description={help}>
      <Input id={`g-${k}`} inputMode="numeric" value={form[k] as string} onChange={(e) => setForm({ ...form, [k]: e.target.value.replace(/\D/g, "") })} />
    </FormField>
  )
  return (
    <FieldGroup>
      <Field>
        <FieldLabel>Working days</FieldLabel>
        <ToggleGroup multiple variant="outline" spacing={1} value={form.days.map(String)} onValueChange={(v) => setForm({ ...form, days: (v as string[]).map(Number) })} className="flex-wrap">
          {DAYS.map((d, i) => (
            <ToggleGroupItem key={d} value={String(i)} className="h-9">
              {d}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Day starts" htmlFor="g-start">
          <Input id="g-start" type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
        </FormField>
        <FormField label="Day ends" htmlFor="g-end">
          <Input id="g-end" type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {num("registration_hours", "Submission → inspector / decision", "Working hours (brief: 48)")}
        {num("inspection_to_certificate_hours", "Inspection → certificate", "Working hours (brief: 48)")}
        {num("claim_screening_hours", "Complaint → screening done", "Working hours")}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {num("care_window_days", "SylvanCare+ registration window", "Days from invoice (policy: 90)")}
        {num("standard_window_days", "Standard e-warranty window", "Days from invoice (agreed: 30)")}
      </div>
      <FormField label="How manufacture date (from 1 Oct 2026) is checked" htmlFor="g-mfg" description="Pending Sylvan's decision">
        <Select value={form.manufacture_check} onValueChange={(v) => setForm({ ...form, manufacture_check: v as GeneralInput["manufacture_check"] })} items={[{ value: "invoice_date", label: "Invoice date on or after 1 Oct 2026" }, { value: "batch_code", label: "Customer enters batch / stamp code" }]}>
          <SelectTrigger id="g-mfg" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectItem value="invoice_date">Invoice date on or after 1 Oct 2026</SelectItem>
            <SelectItem value="batch_code">Customer enters batch / stamp code</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      <FieldError>{error}</FieldError>
      <Button
        className="h-10 w-full sm:w-fit"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError("")
            const res = await updateGeneral(form)
            if (!res.ok) return setError(res.error)
            toast.success("Rules saved")
            router.refresh()
          })
        }
      >
        {pending && <Spinner data-icon="inline-start" />}
        Save rules
      </Button>
    </FieldGroup>
  )
}

export function HolidayList({ holidays }: { holidays: { day: string; name: string }[] }) {
  const router = useRouter()
  const [day, setDay] = useState("")
  const [name, setName] = useState("")
  const [pending, start] = useTransition()
  return (
    <div className="flex flex-col gap-3">
      {holidays.map((h) => (
        <div key={h.day} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
          <span>
            <span className="font-mono">{h.day}</span> · {h.name}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove ${h.name}`}
            onClick={() => start(async () => { await removeHoliday(h.day); router.refresh() })}
          >
            <IconTrash />
          </Button>
        </div>
      ))}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="sm:w-44" />
        <Input placeholder="Holiday name" value={name} onChange={(e) => setName(e.target.value)} />
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await addHoliday(day, name)
              if (!res.ok) return void toast.error(res.error)
              setDay("")
              setName("")
              router.refresh()
            })
          }
        >
          <IconPlus data-icon="inline-start" />
          Add
        </Button>
      </div>
    </div>
  )
}
