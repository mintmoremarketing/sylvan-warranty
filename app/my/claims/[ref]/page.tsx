import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { IconCalendarEvent, IconChevronLeft, IconDownload, IconPhoneCall } from "@tabler/icons-react"

import { DocumentList } from "@/components/document-list"
import { InfoResponseForm } from "@/components/portal/info-response-form"
import { CallbackDialog } from "@/components/site/callback-dialog"
import { ClaimBadge, Timeline } from "@/components/status"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requireCustomer } from "@/lib/auth"
import { formatDate, formatDateTime } from "@/lib/domain/dates"
import { formatINR } from "@/lib/domain/format"
import { fromSlug, toSlug } from "@/lib/domain/numbers"
import { loadClaim } from "@/lib/queries"
import { supabaseAdmin } from "@/lib/supabase/admin"

export const metadata: Metadata = { title: "Complaint" }

const SECTION = "max-xs:rounded-none max-xs:border-y max-xs:ring-0"
const MODES: Record<string, string> = { reimbursement: "Reimbursement", replacement: "Replacement of material", repair: "Repair", cash: "Cash settlement" }

export default async function ClaimPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params
  const customer = await requireCustomer(`/my/claims/${ref}`)
  const claim = await loadClaim(fromSlug(ref))
  if (!claim || claim.customer_id !== customer.id) notFound()

  const pending = claim.status === "info_required" ? claim.infoRequests.findLast((r) => !r.responded_at) : undefined
  const scheduled = claim.inspections.findLast((i) => i.scheduled_at && ["assigned", "scheduled"].includes(i.status))
  let findingLabel: string | null = null
  if (claim.finding_code) {
    const { data } = await supabaseAdmin().from("reason_codes").select("label").eq("code", claim.finding_code).maybeSingle()
    findingLabel = data?.label ?? null
  }

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-3 py-6 xs:px-4 sm:gap-6 sm:py-10">
      <div className="flex flex-col gap-3 px-4 xs:px-0">
        <Button variant="link" className="h-auto w-fit p-0" render={<Link href={`/my/registrations/${toSlug(claim.registration.wrn)}`} />} nativeButton={false}>
          <IconChevronLeft data-icon="inline-start" />
          {claim.registration.wrn}
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-xl font-semibold tracking-tight sm:text-2xl">{claim.claim_no}</h1>
          <ClaimBadge status={claim.status} audience="customer" />
        </div>
        <p className="text-sm text-muted-foreground">Submitted on {formatDateTime(claim.submitted_at)}</p>
      </div>

      {pending && (
        <Card className={SECTION}>
          <CardHeader>
            <CardTitle>We need more information</CardTitle>
          </CardHeader>
          <CardContent>
            <InfoResponseForm requestId={pending.id} items={pending.requested_items} remarks={pending.remarks} />
          </CardContent>
        </Card>
      )}

      {scheduled && claim.status === "inspection_scheduled" && (
        <Alert className="max-xs:mx-4 max-xs:w-auto">
          <IconCalendarEvent />
          <AlertTitle>Inspection scheduled for {formatDateTime(scheduled.scheduled_at)}</AlertTitle>
          <AlertDescription>
            Inspector: {scheduled.staff?.full_name}. Please keep your SylvanCare+ certificate and invoice ready.
          </AlertDescription>
        </Alert>
      )}

      {claim.decision && (
        <Card className={SECTION}>
          <CardHeader>
            <CardTitle>
              {claim.decision === "rejected" ? "Claim rejected" : claim.decision === "partially_approved" ? "Claim partially approved" : "Claim approved"}
            </CardTitle>
            <CardDescription>Decided on {formatDate(claim.decided_at)}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            {findingLabel && (
              <p>
                <span className="text-muted-foreground">Finding: </span>
                {findingLabel}
              </p>
            )}
            {claim.decision_remarks && <p>{claim.decision_remarks}</p>}
            {claim.compensation?.approved_at && (
              <p>
                <span className="text-muted-foreground">Approved compensation: </span>
                <span className="font-medium">{formatINR(claim.compensation.total_payable)}</span>
              </p>
            )}
            {claim.settlement && (
              <p>
                <span className="text-muted-foreground">Settlement: </span>
                {MODES[claim.settlement.mode]} · {claim.settlement.status === "completed" ? `completed ${formatDate(claim.settlement.completed_at)}` : "in progress"}
              </p>
            )}
            {claim.status === "closed" && claim.decision !== "rejected" && (
              <Button variant="outline" className="w-fit" render={<a href={`/api/certificates/closure/${ref}`} target="_blank" />} nativeButton={false}>
                <IconDownload data-icon="inline-start" />
                Claim closure certificate
              </Button>
            )}
            {claim.decision === "rejected" && (
              <CallbackDialog defaultTopic="Raise or track a complaint" render={<Button variant="outline" className="w-fit" />}>
                <IconPhoneCall data-icon="inline-start" />
                Request a call back
              </CallbackDialog>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:gap-6 md:grid-cols-[1fr_1.2fr]">
        <Card className={SECTION}>
          <CardHeader>
            <CardTitle>Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <Timeline
              entries={claim.audit
                .filter((a) => a.visible_to_customer)
                .map((a) => ({ id: a.id, title: a.customer_message ?? a.action, at: a.created_at }))
                .reverse()}
            />
          </CardContent>
        </Card>
        <Card className={SECTION}>
          <CardHeader>
            <CardTitle>Your complaint</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2">
              <dt className="text-muted-foreground">Product</dt>
              <dd>{claim.item?.product_name}</dd>
              <dt className="text-muted-foreground">Problem</dt>
              <dd>{claim.complaint_type}</dd>
              <dt className="text-muted-foreground">Affected sheets</dt>
              <dd>{claim.affected_qty}</dd>
              <dt className="text-muted-foreground">Noticed on</dt>
              <dd>{formatDate(claim.noticed_on)}</dd>
            </dl>
            <p className="whitespace-pre-line">{claim.description}</p>
            <DocumentList docs={claim.documents.filter((d) => d.kind.startsWith("claim_"))} />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
