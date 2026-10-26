import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { IconPhone } from "@tabler/icons-react"

import { InspectionForm } from "@/components/console/inspection-form"
import { InspectionReport } from "@/components/console/inspection-report"
import { CONSOLE_CARD, PageBody, PageHeader } from "@/components/console/page-header"
import { ScheduleControl } from "@/components/console/schedule-control"
import { DocumentList } from "@/components/document-list"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { hasRole, requireStaff } from "@/lib/auth"
import { categoryLabel, INSPECTION_STATUS } from "@/lib/domain/constants"
import { formatDate, formatDateTime } from "@/lib/domain/dates"
import { formatMobile } from "@/lib/domain/format"
import { formFor } from "@/lib/domain/inspection-forms"
import { toSlug } from "@/lib/domain/numbers"
import { loadClaim, loadRegistration, type Inspection } from "@/lib/queries"
import { supabaseAdmin } from "@/lib/supabase/admin"

export const metadata: Metadata = { title: "Inspection" }

export default async function InspectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const staff = await requireStaff(["inspector", "verifier", "approver", "technical", "customer_care", "management"], `/console/inspections/${id}`)
  const { data: row } = await supabaseAdmin().from("inspections").select("id, registration_id, claim_id, inspector_id, registrations(wrn), claims(claim_no)").eq("id", id).maybeSingle()
  if (!row) notFound()
  if (row.inspector_id !== staff.id && !hasRole(staff, ["verifier", "approver", "technical", "customer_care", "management"])) notFound()

  const wrn = (row.registrations as unknown as { wrn: string }).wrn
  const claimNo = (row.claims as unknown as { claim_no: string } | null)?.claim_no
  const reg = (await loadRegistration(wrn))!
  const claim = claimNo ? await loadClaim(claimNo) : null
  const inspection = (claim?.inspections ?? reg.inspections).find((i) => i.id === id) as Inspection
  const docs = (claim?.documents ?? reg.documents).filter((d) => d.inspection_id === id)
  const open = ["assigned", "scheduled", "revisit_required"].includes(inspection.status)
  const mine = inspection.inspector_id === staff.id || hasRole(staff, ["admin"])
  const form = formFor(inspection.kind)

  const lines = claim ? (claim.item ? [claim.item] : []) : reg.items.filter((i) => i.care_plus)
  const summary: [string, React.ReactNode][] = [
    ...(claim ? ([["Claim ID", <span key="c" className="font-mono">{claim.claim_no}</span>], ["Complaint", `${claim.complaint_type} — ${claim.affected_qty} sheets claimed`]] as [string, React.ReactNode][]) : []),
    ["Registration", <span key="w" className="font-mono">{reg.wrn}</span>],
    ["Owner", reg.owner_name],
    [
      "Mobile",
      <a key="m" href={`tel:+91${reg.owner_mobile}`} className="inline-flex items-center gap-1 underline underline-offset-4">
        <IconPhone className="size-3.5" />
        {formatMobile(reg.owner_mobile)}
      </a>,
    ],
    ["Site", `${reg.site_address}, ${reg.city}, ${reg.district}, ${reg.state} ${reg.pincode}`],
    ["Invoice", reg.invoices.map((i) => `${i.invoice_number} (${formatDate(i.invoice_date)}) · ${i.dealer_name}`).join("; ")],
    ["Covered product", lines.map((i) => `${i.product_name} ${categoryLabel(i.category).toLowerCase()} — ${i.qty_used} sheets registered`).join("; ")],
  ]

  return (
    <>
      <PageHeader
        back={{ href: "/console/inspections", label: "Inspections" }}
        title={form.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{INSPECTION_STATUS[inspection.status as keyof typeof INSPECTION_STATUS]}</Badge>
            <span>Inspector: {inspection.staff?.full_name}</span>
            {inspection.scheduled_at && <span>· {formatDateTime(inspection.scheduled_at)}</span>}
          </span>
        }
        actions={open && mine ? <ScheduleControl id={id} scheduled={!!inspection.scheduled_at} /> : undefined}
      />
      <PageBody>
        {inspection.status === "revisit_required" && (
          <Alert className="max-sm:mx-4 max-sm:w-auto">
            <AlertTitle>Revisit required</AlertTitle>
            <AlertDescription>{(inspection.answers as { values?: { remarks?: string } }).values?.remarks}</AlertDescription>
          </Alert>
        )}
        <Card className={CONSOLE_CARD}>
          <CardHeader>
            <CardTitle>Before you go</CardTitle>
            <CardDescription>Pre-filled from the {claim ? "claim and " : ""}registration. Ask the owner for the SylvanCare+ certificate and original invoice.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <dl className="grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-2 text-sm">
              {summary.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            {claim && <DocumentList docs={claim.documents.filter((d) => d.kind.startsWith("claim_"))} />}
            <Button variant="outline" className="w-fit" render={<a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${reg.site_address}, ${reg.city}, ${reg.pincode}`)}`} target="_blank" rel="noreferrer" />} nativeButton={false}>
              Directions
            </Button>
          </CardContent>
        </Card>

        {open && mine ? (
          <InspectionForm id={id} form={form} />
        ) : inspection.submitted_at ? (
          <InspectionReport inspection={inspection} docs={docs} />
        ) : (
          <p className="px-4 text-sm text-muted-foreground sm:px-0">Not submitted yet.</p>
        )}

        <div className="flex flex-wrap gap-2 px-4 sm:px-0">
          <Button variant="ghost" render={<Link href={claim ? `/console/claims/${toSlug(claim.claim_no)}` : `/console/registrations/${toSlug(reg.wrn)}`} />} nativeButton={false}>
            Open {claim ? "claim" : "registration"}
          </Button>
        </div>
      </PageBody>
    </>
  )
}
