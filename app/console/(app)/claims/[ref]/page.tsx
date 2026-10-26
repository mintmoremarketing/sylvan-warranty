import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { IconDownload } from "@tabler/icons-react"

import {
  ApproveCompensation,
  AssignClaimInspector,
  AutoStartScreening,
  ClaimInfoRequest,
  CloseClaim,
  CompensationEditor,
  CompleteSettlement,
  CustodyForm,
  DecisionDrawer,
  FinanceApprove,
  LabReportForm,
  SampleForm,
  ScreeningPanel,
  SettlementForm,
  StartTechnicalReview,
} from "@/components/console/claim-actions"
import { CONSOLE_CARD, PageBody, PageHeader } from "@/components/console/page-header"
import { DocumentList } from "@/components/document-list"
import { ClaimBadge, SlaBadge, Timeline } from "@/components/status"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { hasRole, requireStaff } from "@/lib/auth"
import { SETTLEMENT_MODES } from "@/lib/domain/compensation"
import { INSPECTION_STATUS } from "@/lib/domain/constants"
import { formatDate, formatDateTime } from "@/lib/domain/dates"
import { formatINR, formatMobile } from "@/lib/domain/format"
import { fromSlug, toSlug } from "@/lib/domain/numbers"
import { loadClaim } from "@/lib/queries"
import { supabaseAdmin } from "@/lib/supabase/admin"

export const metadata: Metadata = { title: "Claim review" }

export default async function ClaimReview({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params
  const staff = await requireStaff(["verifier", "technical", "approver", "finance", "customer_care", "management"], `/console/claims/${ref}`)
  const claim = await loadClaim(fromSlug(ref))
  if (!claim) notFound()
  const reg = claim.registration
  const item = claim.item

  const db = supabaseAdmin()
  const [{ data: inspectors }, { data: findings }, { data: names }] = await Promise.all([
    db.from("staff").select("id, full_name, regions").contains("roles", ["inspector"]).eq("active", true).order("full_name"),
    db.from("reason_codes").select("code, label").eq("context", "claim_finding").order("sort"),
    db.from("staff").select("id, full_name"),
  ])
  const nameOf = new Map((names ?? []).map((n) => [n.id, n.full_name]))
  const findingOptions = (findings ?? []).map((f) => ({ value: f.code, label: f.label }))
  const findingLabel = findingOptions.find((f) => f.value === claim.finding_code)?.label
  const inspectorOptions = (inspectors ?? []).map((i) => ({ value: i.id, label: `${i.full_name}${(i.regions as string[]).includes(reg.state) ? " · same state" : ""}` }))

  const covered = item ? item.qty_used - item.utilised_qty : 0
  const auto = {
    active_warranty: reg.status === "active",
    within_period: !!item?.care_expiry && item.care_expiry >= claim.submitted_at.slice(0, 10) && (!item.care_start || claim.noticed_on >= item.care_start),
    product_covered: !!item?.care_plus,
    qty_eligible: claim.affected_qty <= covered,
    no_previous_claims: true,
  }

  const st = claim.status
  const can = (r: Parameters<typeof hasRole>[1]) => hasRole(staff, r)
  const settlementInit = {
    bank_verified: claim.settlement?.bank_verified ?? false,
    bank_reference: claim.settlement?.bank_reference ?? "",
    replacement_details: claim.settlement?.replacement_details ?? "",
    payment_reference: claim.settlement?.payment_reference ?? "",
    customer_accepted: !!claim.settlement?.customer_accepted_at,
    restoration_confirmed: !!claim.settlement?.restoration_confirmed_at,
    notes: claim.settlement?.notes ?? "",
  }

  return (
    <>
      <AutoStartScreening id={claim.id} active={st === "received" && can(["verifier"])} />
      <PageHeader
        back={{ href: "/console/claims", label: "Claims" }}
        title={<span className="font-mono text-lg sm:text-2xl">{claim.claim_no}</span>}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <ClaimBadge status={st} audience="staff" />
            {!["closed", "rejected", "settlement_completed"].includes(st) && <SlaBadge due={claim.sla_due_at} />}
            <span>Submitted {formatDateTime(claim.submitted_at)}</span>
          </span>
        }
      />
      <PageBody>
        <div className="grid gap-3 sm:gap-5 lg:grid-cols-[1.3fr_1fr]">
          <div className="flex min-w-0 flex-col gap-3 sm:gap-5">
            <Card className={CONSOLE_CARD}>
              <CardHeader>
                <CardTitle>Complaint vs registration</CardTitle>
                <CardDescription>Policy 5.6: details at claim time must match the registration.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead />
                      <TableHead>Registration ({reg.wrn})</TableHead>
                      <TableHead>Complaint</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="text-muted-foreground">Owner</TableCell>
                      <TableCell className="whitespace-normal">{reg.owner_name} · {formatMobile(reg.owner_mobile)}</TableCell>
                      <TableCell className="whitespace-normal">
                        {claim.channel === "customer_care" ? "Raised by Customer Care (toll-free call)" : "Raised from the owner's login"}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-muted-foreground">Site</TableCell>
                      <TableCell className="whitespace-normal" colSpan={2}>{reg.site_address}, {reg.city} {reg.pincode}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-muted-foreground">Product</TableCell>
                      <TableCell>{item?.product_name}</TableCell>
                      <TableCell>{claim.complaint_type}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-muted-foreground">Quantity</TableCell>
                      <TableCell>{item?.qty_used} covered{item?.utilised_qty ? ` (${item.utilised_qty} already compensated)` : ""}</TableCell>
                      <TableCell>{claim.affected_qty} affected</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-muted-foreground">Dates</TableCell>
                      <TableCell className="whitespace-normal">Valid {formatDate(item?.care_start)} – {formatDate(item?.care_expiry)}</TableCell>
                      <TableCell>Noticed {formatDate(claim.noticed_on)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
                <p className="mt-4 text-sm whitespace-pre-line">{claim.description}</p>
                <div className="mt-3">
                  <DocumentList docs={claim.documents.filter((d) => d.kind.startsWith("claim_"))} />
                </div>
                <Button variant="link" className="mt-2 h-auto p-0" render={<Link href={`/console/registrations/${toSlug(reg.wrn)}`} />} nativeButton={false}>
                  Open registration {reg.wrn}
                </Button>
              </CardContent>
            </Card>

            {st === "under_review" && can(["verifier"]) && (
              <Card className={CONSOLE_CARD}>
                <CardHeader>
                  <CardTitle>Pre-screening</CardTitle>
                  <CardDescription>All checks must pass to proceed. Every claim then needs a site inspection (policy 5.5).</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScreeningPanel id={claim.id} auto={auto} findings={findingOptions} />
                </CardContent>
              </Card>
            )}

            <Card className={CONSOLE_CARD}>
              <CardHeader>
                <CardTitle>Inspection</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {claim.inspections.length === 0 && <p className="text-sm text-muted-foreground">No inspection yet.</p>}
                <ItemGroup className="gap-2">
                  {claim.inspections.map((i) => (
                    <Item key={i.id} variant="outline" size="sm" render={<Link href={`/console/inspections/${i.id}`} />}>
                      <ItemContent>
                        <ItemTitle>
                          {i.staff?.full_name} <Badge variant="secondary">{INSPECTION_STATUS[i.status as keyof typeof INSPECTION_STATUS]}</Badge>
                        </ItemTitle>
                        <ItemDescription>
                          {i.submitted_at ? `Report submitted ${formatDateTime(i.submitted_at)}` : i.scheduled_at ? `Scheduled ${formatDateTime(i.scheduled_at)}` : "Not scheduled"}
                        </ItemDescription>
                      </ItemContent>
                    </Item>
                  ))}
                </ItemGroup>
                <div className="flex flex-wrap gap-2">
                  {["inspection_required", "inspection_scheduled"].includes(st) && can(["verifier"]) && (
                    <AssignClaimInspector id={claim.id} inspectors={inspectorOptions} reassign={claim.inspections.some((i) => i.status !== "cancelled")} />
                  )}
                  {st === "inspection_completed" && can(["technical"]) && <StartTechnicalReview id={claim.id} />}
                </div>
              </CardContent>
            </Card>

            {(["inspection_completed", "technical_review", "further_testing"].includes(st) || claim.samples.length > 0 || claim.labReports.length > 0) && (
              <Card className={CONSOLE_CARD}>
                <CardHeader>
                  <CardTitle>Samples and testing</CardTitle>
                  <CardDescription>Chain of custody is recorded for every sample.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {claim.samples.map((s) => (
                    <div key={s.id} className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">Seal {s.seal_no}</span>
                        {s.customer_ack && <Badge variant="secondary">Customer acknowledged</Badge>}
                      </div>
                      <p className="text-muted-foreground">{s.description}</p>
                      <ol className="ml-4 list-disc text-muted-foreground">
                        {[...s.custody_events].sort((a, b) => a.at.localeCompare(b.at)).map((e) => (
                          <li key={e.id}>
                            {formatDateTime(e.at)} — {e.event} at {e.location} ({e.handled_by})
                          </li>
                        ))}
                      </ol>
                      {can(["technical", "inspector"]) && <CustodyForm sampleId={s.id} />}
                    </div>
                  ))}
                  {claim.labReports.map((l) => (
                    <div key={l.id} className="flex flex-col gap-1 rounded-lg border p-3 text-sm">
                      <span className="font-medium">
                        {l.lab_name} {l.report_no && `· ${l.report_no}`}{" "}
                        <Badge variant={l.result === "defect_confirmed" ? "default" : l.result === "no_defect" ? "destructive" : "outline"}>{l.result.replace("_", " ")}</Badge>
                      </span>
                      <span className="text-muted-foreground">{formatDate(l.report_date)}</span>
                      <p>{l.summary}</p>
                      <DocumentList docs={claim.documents.filter((d) => d.id === l.document_id)} empty="" />
                    </div>
                  ))}
                  {["inspection_completed", "technical_review", "further_testing"].includes(st) && (
                    <div className="flex flex-wrap gap-2">
                      {can(["technical", "inspector"]) && <SampleForm id={claim.id} />}
                      {can(["technical"]) && <LabReportForm id={claim.id} samples={claim.samples.map((s) => ({ value: s.id, label: s.seal_no }))} />}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {(st === "technical_review" || claim.decision) && (
              <Card className={CONSOLE_CARD}>
                <CardHeader>
                  <CardTitle>Technical decision</CardTitle>
                  {claim.decision && (
                    <CardDescription>
                      {claim.decision.replace("_", " ")} by {nameOf.get(claim.decided_by ?? "")} on {formatDateTime(claim.decided_at)}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="flex flex-col gap-3 text-sm">
                  {claim.decision ? (
                    <>
                      <p>
                        <span className="text-muted-foreground">Finding: </span>
                        {findingLabel}
                      </p>
                      {claim.approved_qty != null && (
                        <p>
                          <span className="text-muted-foreground">Approved quantity: </span>
                          {claim.approved_qty} sheets
                        </p>
                      )}
                      <p className="whitespace-pre-line">{claim.decision_remarks}</p>
                    </>
                  ) : (
                    can(["technical"]) && (
                      <div className="flex flex-wrap gap-2">
                        <DecisionDrawer id={claim.id} findings={findingOptions} maxQty={claim.affected_qty} />
                        <ClaimInfoRequest id={claim.id} />
                      </div>
                    )
                  )}
                </CardContent>
              </Card>
            )}

            {(["approved", "partially_approved"].includes(st) || claim.compensation) && (
              <Card className={CONSOLE_CARD}>
                <CardHeader>
                  <CardTitle>Compensation</CardTitle>
                  {claim.compensation && (
                    <CardDescription>
                      Prepared by {nameOf.get(claim.compensation.prepared_by)}
                      {claim.compensation.approved_at && ` · approved by ${nameOf.get(claim.compensation.approved_by!)}`}
                      {claim.compensation.finance_approved_at && ` · finance ${nameOf.get(claim.compensation.finance_approved_by!)}`}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {["approved", "partially_approved"].includes(st) && !claim.compensation?.approved_at && can(["technical"]) ? (
                    <CompensationEditor id={claim.id} initial={claim.compensation?.lines ?? []} />
                  ) : claim.compensation ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead className="text-right">Claimed</TableHead>
                          <TableHead className="text-right">Estimate</TableHead>
                          <TableHead className="text-right">Payable</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {claim.compensation.lines.filter((l) => l.payable > 0).map((l) => (
                          <TableRow key={l.key}>
                            <TableCell className="whitespace-normal">{l.label}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatINR(l.claimed)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatINR(l.estimate)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatINR(l.payable)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                      <TableFooter>
                        <TableRow>
                          <TableCell colSpan={3}>Total payable</TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">{formatINR(claim.compensation.total_payable)}</TableCell>
                        </TableRow>
                      </TableFooter>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted-foreground">Waiting for HO technical to prepare the compensation sheet.</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {claim.compensation && !claim.compensation.approved_at && can(["approver"]) && <ApproveCompensation id={claim.id} />}
                    {claim.compensation?.approved_at && !claim.compensation.finance_approved_at && can(["finance"]) && <FinanceApprove id={claim.id} />}
                  </div>
                </CardContent>
              </Card>
            )}

            {claim.settlement && (
              <Card className={CONSOLE_CARD}>
                <CardHeader>
                  <CardTitle>Settlement — {SETTLEMENT_MODES.find((m) => m.value === claim.settlement!.mode)?.label}</CardTitle>
                  <CardDescription>{claim.settlement.status === "completed" ? `Completed ${formatDateTime(claim.settlement.completed_at)}` : "In progress"}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {st === "settlement_in_progress" && can(["finance"]) ? (
                    <SettlementForm id={claim.id} initial={settlementInit} />
                  ) : (
                    <dl className="grid grid-cols-[10rem_1fr] gap-x-3 gap-y-2 text-sm">
                      <dt className="text-muted-foreground">Bank verified</dt>
                      <dd>{claim.settlement.bank_verified ? "Yes" : "No"}</dd>
                      <dt className="text-muted-foreground">Payment reference</dt>
                      <dd>{claim.settlement.payment_reference ?? "—"}</dd>
                      <dt className="text-muted-foreground">Replacement / labour</dt>
                      <dd>{claim.settlement.replacement_details ?? "—"}</dd>
                      <dt className="text-muted-foreground">Customer accepted</dt>
                      <dd>{formatDateTime(claim.settlement.customer_accepted_at)}</dd>
                      <dt className="text-muted-foreground">Restoration confirmed</dt>
                      <dd>{formatDateTime(claim.settlement.restoration_confirmed_at)}</dd>
                    </dl>
                  )}
                  <DocumentList docs={claim.documents.filter((d) => d.kind === "settlement_photo")} empty="No before/after photos yet." />
                  <div className="flex flex-wrap gap-2">
                    {st === "settlement_in_progress" && can(["finance"]) && <CompleteSettlement id={claim.id} />}
                    {st === "settlement_completed" && can(["finance"]) && <CloseClaim id={claim.id} />}
                    {st === "closed" && (
                      <Button variant="outline" render={<a href={`/api/certificates/closure/${ref}`} target="_blank" />} nativeButton={false}>
                        <IconDownload data-icon="inline-start" />
                        Closure certificate
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-3 sm:gap-5">
            {claim.infoRequests.length > 0 && (
              <Card className={CONSOLE_CARD}>
                <CardHeader>
                  <CardTitle>Information requests</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {claim.infoRequests.map((r) => (
                    <div key={r.id} className="flex flex-col gap-1 rounded-lg border p-3 text-sm">
                      <p className="font-medium">{r.requested_items.join(", ")}</p>
                      <p className="text-muted-foreground">{r.remarks}</p>
                      {r.responded_at ? (
                        <>
                          <Badge variant="secondary" className="w-fit">Answered {formatDateTime(r.responded_at)}</Badge>
                          {r.response_note && <p>{r.response_note}</p>}
                          <DocumentList docs={claim.documents.filter((d) => d.info_request_id === r.id)} empty="" />
                        </>
                      ) : (
                        <Badge variant="outline" className="w-fit">Waiting for customer</Badge>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
            <Card className={CONSOLE_CARD}>
              <CardHeader>
                <CardTitle>Audit trail</CardTitle>
                <CardDescription>Every step, who did it and when — permanent.</CardDescription>
              </CardHeader>
              <CardContent>
                <Timeline
                  entries={[...claim.audit].reverse().map((a) => ({
                    id: a.id,
                    title: a.action.replaceAll("_", " "),
                    detail: [a.remarks, (a.data as { finding?: string }).finding, (a.data as { inspector?: string }).inspector && `Inspector: ${(a.data as { inspector?: string }).inspector}`, (a.data as { total?: number }).total != null && `Total ${formatINR((a.data as { total?: number }).total)}`]
                      .filter(Boolean)
                      .join("\n"),
                    who: a.actor_label,
                    at: a.created_at,
                  }))}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </PageBody>
    </>
  )
}
