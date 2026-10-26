import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  IconCalendarEvent,
  IconCertificate,
  IconChevronLeft,
  IconDownload,
  IconMessageReport,
  IconPhoneCall,
} from "@tabler/icons-react"

import { DocumentList } from "@/components/document-list"
import { InfoResponseForm } from "@/components/portal/info-response-form"
import { CallbackDialog } from "@/components/site/callback-dialog"
import { ClaimBadge, EWarrantyBadge, RegistrationBadge, Timeline } from "@/components/status"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { requireCustomer } from "@/lib/auth"
import { categoryLabel } from "@/lib/domain/constants"
import { formatDate, formatDateTime, todayIST } from "@/lib/domain/dates"
import { formatMobile } from "@/lib/domain/format"
import { fromSlug, toSlug } from "@/lib/domain/numbers"
import { loadRegistration, rejectionReason } from "@/lib/queries"

export const metadata: Metadata = { title: "Registration" }

const SECTION = "max-xs:rounded-none max-xs:border-y max-xs:ring-0"

export default async function RegistrationPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params
  const customer = await requireCustomer(`/my/registrations/${ref}`)
  const reg = await loadRegistration(fromSlug(ref))
  if (!reg || reg.customer_id !== customer.id) notFound()

  const pendingRequest = reg.status === "info_required" ? reg.infoRequests.findLast((r) => !r.responded_at) : undefined
  const scheduled = reg.inspections.findLast((i) => i.kind === "registration" && i.scheduled_at && ["assigned", "scheduled"].includes(i.status))
  const revisit = reg.inspections.findLast((i) => i.kind === "registration")?.status === "revisit_required"
  const rejection = reg.status === "rejected" ? await rejectionReason(reg.id) : null
  const careItems = reg.items.filter((i) => i.care_plus)
  const expiry = careItems.map((i) => i.care_expiry).filter(Boolean).sort().pop() ?? null
  const expired = reg.status === "active" && !!expiry && expiry < todayIST()
  const canClaim = reg.status === "active" && !expired && !reg.claim_locked_at
  const slug = toSlug(reg.wrn)

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-3 py-6 xs:px-4 sm:gap-6 sm:py-10">
      <div className="flex flex-col gap-3 px-4 xs:px-0">
        <Button variant="link" className="h-auto w-fit p-0" render={<Link href="/my" />} nativeButton={false}>
          <IconChevronLeft data-icon="inline-start" />
          My warranties
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-2xl font-semibold tracking-tight">{reg.wrn}</h1>
          {reg.care_plus && (expired ? <Badge variant="outline">Expired</Badge> : <RegistrationBadge status={reg.status} audience="customer" />)}
        </div>
        <p className="text-sm text-muted-foreground">Registered on {formatDateTime(reg.submitted_at)}</p>
      </div>

      {pendingRequest && (
        <Card className={SECTION}>
          <CardHeader>
            <CardTitle>We need more information</CardTitle>
            <CardDescription>Requested on {formatDateTime(pendingRequest.requested_at)}</CardDescription>
          </CardHeader>
          <CardContent>
            <InfoResponseForm requestId={pendingRequest.id} items={pendingRequest.requested_items} remarks={pendingRequest.remarks} />
          </CardContent>
        </Card>
      )}

      {scheduled && reg.status === "inspector_assigned" && (
        <Alert className="max-xs:mx-4 max-xs:w-auto">
          <IconCalendarEvent />
          <AlertTitle>Site inspection scheduled for {formatDateTime(scheduled.scheduled_at)}</AlertTitle>
          <AlertDescription>
            Inspector: {scheduled.staff?.full_name}. Please keep the installation area accessible and your invoice handy.
          </AlertDescription>
        </Alert>
      )}
      {revisit && reg.status === "inspector_assigned" && (
        <Alert className="max-xs:mx-4 max-xs:w-auto">
          <IconCalendarEvent />
          <AlertTitle>Inspection incomplete: revisit required</AlertTitle>
          <AlertDescription>The installation wasn&apos;t available during the visit. We&apos;ll contact you to schedule another one.</AlertDescription>
        </Alert>
      )}

      {reg.status === "rejected" && (
        <Card className={SECTION}>
          <CardHeader>
            <CardTitle>SylvanCare+ registration not approved</CardTitle>
            <CardDescription>Reason: {rejection?.reason || "—"}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            {rejection?.remarks && <p>{rejection.remarks}</p>}
            <p className="text-muted-foreground">
              The standard Sylvan product warranty remains applicable as per its terms. Standard warranty certificates, where applicable, are listed below and sent to your email.
            </p>
            <CallbackDialog defaultTopic="Warranty status" render={<Button variant="outline" className="w-fit" />}>
              <IconPhoneCall data-icon="inline-start" />
              Request a call back
            </CallbackDialog>
          </CardContent>
        </Card>
      )}

      {/* SylvanCare+ coverage */}
      {reg.care_plus && (
        <Card className={SECTION}>
          <CardHeader>
            <CardTitle>SylvanCare+ warranty</CardTitle>
            <CardDescription>
              {reg.status === "active"
                ? reg.claim_locked_at
                  ? "Claim registered — this warranty is inactive for further claims."
                  : "Your warranty is active. Keep the certificate with your invoice."
                : "Your certificate will appear here once verification is complete."}
            </CardDescription>
            {reg.status === "active" && (
              <CardAction>
                <Button variant="outline" render={<a href={`/api/certificates/care-plus/${slug}`} target="_blank" />} nativeButton={false}>
                  <IconDownload data-icon="inline-start" />
                  Certificate
                </Button>
              </CardAction>
            )}
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Covered qty</TableHead>
                  <TableHead>Valid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {careItems.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>{i.product_name}</TableCell>
                    <TableCell>{i.qty_used} sheets</TableCell>
                    <TableCell className="whitespace-normal">{i.care_start ? `${formatDate(i.care_start)} – ${formatDate(i.care_expiry)}` : "After approval"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex flex-wrap gap-2">
              {canClaim && (
                <Button render={<Link href={`/my/registrations/${slug}/complaint`} />} nativeButton={false}>
                  <IconMessageReport data-icon="inline-start" />
                  Raise a complaint
                </Button>
              )}
              {reg.claim && (
                <Button variant="outline" render={<Link href={`/my/claims/${toSlug(reg.claim.claim_no)}`} />} nativeButton={false}>
                  Track complaint {reg.claim.claim_no}
                  <ClaimBadge status={reg.claim.status} audience="customer" className="ml-1" />
                </Button>
              )}
              <Button variant="ghost" render={<Link href="/policy" />} nativeButton={false}>
                View policy
              </Button>
              <CallbackDialog render={<Button variant="ghost" />}>Request a call back</CallbackDialog>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Standard e-warranties */}
      {reg.eWarranties.length > 0 && (
        <Card className={SECTION}>
          <CardHeader>
            <CardTitle>Standard e-warranty</CardTitle>
            <CardDescription>Issued by your area&apos;s Sylvan sales coordinator after a quick review.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {reg.eWarranties.map((e) => (
              <div key={e.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <IconCertificate className="size-4 text-muted-foreground" />
                    <span className="font-medium">{e.number ?? "Certificate number on issue"}</span>
                    <EWarrantyBadge status={e.status} audience="customer" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {e.e_warranty_items.map((i) => `${i.product_name} ${categoryLabel(i.category).toLowerCase()} × ${i.qty} (${i.warranty_period})`).join(", ")}
                  </p>
                  {e.status === "rejected" && e.reject_reason && <p className="text-sm text-destructive">{e.reject_reason}</p>}
                </div>
                {e.status === "issued" && (
                  <Button variant="outline" render={<a href={`/api/certificates/e-warranty/${e.id}`} target="_blank" />} nativeButton={false}>
                    <IconDownload data-icon="inline-start" />
                    Download
                  </Button>
                )}
              </div>
            ))}
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
              entries={reg.audit
                .filter((a) => a.visible_to_customer)
                .map((a) => ({ id: a.id, title: a.customer_message ?? a.action, at: a.created_at }))
                .reverse()}
            />
          </CardContent>
        </Card>

        <Card className={SECTION}>
          <CardHeader>
            <CardTitle>Registration details</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2">
              <dt className="text-muted-foreground">Owner</dt>
              <dd>{reg.owner_name}</dd>
              <dt className="text-muted-foreground">Mobile</dt>
              <dd>{formatMobile(reg.owner_mobile)}</dd>
              <dt className="text-muted-foreground">Site</dt>
              <dd>
                {reg.site_address}, {reg.city}, {reg.district}, {reg.state} {reg.pincode}
              </dd>
            </dl>
            {reg.invoices.map((inv) => (
              <div key={inv.id} className="flex flex-col gap-2 rounded-lg border p-3">
                <p className="font-medium">
                  Invoice {inv.invoice_number} · {formatDate(inv.invoice_date)}
                </p>
                <p className="text-muted-foreground">{inv.dealer_name}</p>
                <ul className="text-muted-foreground">
                  {reg.items
                    .filter((i) => i.invoice_id === inv.id)
                    .map((i) => (
                      <li key={i.id}>
                        {i.product_name} ({categoryLabel(i.category)}) — {i.qty_purchased} purchased, {i.qty_used} used here
                      </li>
                    ))}
                </ul>
                <DocumentList docs={reg.documents.filter((d) => d.invoice_id === inv.id)} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
