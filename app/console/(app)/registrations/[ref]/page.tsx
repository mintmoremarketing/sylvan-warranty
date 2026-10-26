import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { IconCheck, IconExternalLink, IconMapPin, IconMessageReport, IconQuestionMark, IconX } from "@tabler/icons-react"

import { FlagList } from "@/components/console/flag-list"
import { CONSOLE_CARD, PageBody, PageHeader } from "@/components/console/page-header"
import { RegistrationActions } from "@/components/console/registration-actions"
import { DocumentList } from "@/components/document-list"
import { EWarrantyBadge, RegistrationBadge, SlaBadge, Timeline } from "@/components/status"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { hasRole, requireStaff } from "@/lib/auth"
import {
  categoryLabel,
  INSPECTION_STATUS,
  INSTALLATION_STATUSES,
  PROPERTY_TYPES,
  REFERRAL_TYPES,
  VERIFICATION_CHECKS,
  type VerificationKey,
  type VerificationResult,
} from "@/lib/domain/constants"
import { daysBetween, formatDate, formatDateTime } from "@/lib/domain/dates"
import { formatMobile } from "@/lib/domain/format"
import { fromSlug, toSlug } from "@/lib/domain/numbers"
import { loadRegistration } from "@/lib/queries"
import { getSettings } from "@/lib/settings"
import { supabaseAdmin } from "@/lib/supabase/admin"

export const metadata: Metadata = { title: "Registration review" }

function Check({ ok, label, note, muted }: { ok: boolean | null; label: string; note?: string; muted?: boolean }) {
  return (
    <li className={`flex gap-2 text-sm ${muted ? "text-muted-foreground" : ""}`}>
      {ok === true ? <IconCheck className="mt-0.5 size-4 shrink-0 text-primary" /> : ok === false ? <IconX className="mt-0.5 size-4 shrink-0 text-destructive" /> : <IconQuestionMark className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
      <span>
        {label}
        {note && <span className="text-muted-foreground"> — {note}</span>}
      </span>
    </li>
  )
}

export default async function RegistrationReview({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params
  const staff = await requireStaff(["verifier", "approver", "customer_care", "management"], `/console/registrations/${ref}`)
  const reg = await loadRegistration(fromSlug(ref))
  if (!reg) notFound()

  const db = supabaseAdmin()
  const [settings, { data: flags }, { data: inspectors }, { data: reasons }, { data: dealers }, { data: staffNames }] = await Promise.all([
    getSettings(),
    db.from("fraud_flags").select("id, code, severity, detail, status, cleared_reason").eq("registration_id", reg.id).is("claim_id", null).order("created_at"),
    db.from("staff").select("id, full_name, regions").contains("roles", ["inspector"]).eq("active", true).order("full_name"),
    db.from("reason_codes").select("code, label, context").in("context", ["registration_reject", "no_inspection"]).order("sort"),
    db.from("dealers").select("id, authorised").in("id", reg.invoices.map((i) => i.dealer_id).filter(Boolean) as string[]),
    db.from("staff").select("id, full_name"),
  ])
  const nameOf = new Map((staffNames ?? []).map((s) => [s.id, s.full_name]))
  const openFlags = (flags ?? []).filter((f) => f.status === "open")
  const label = (list: readonly { value: string; label: string }[], v: string | null) => list.find((x) => x.value === v)?.label ?? v ?? "—"
  const authorised = new Map((dealers ?? []).map((d) => [d.id, d.authorised]))

  const inspectorOptions = (inspectors ?? []).map((i) => ({
    value: i.id,
    label: `${i.full_name}${(i.regions as string[]).length ? ` (${(i.regions as string[]).join(", ")})` : ""}${(i.regions as string[]).includes(reg.state) ? " · same state" : ""}`,
  }))

  const submittedDay = reg.submitted_at.slice(0, 10)
  const careLines = reg.items.filter((i) => i.care_plus)
  const oldestInvoiceAge = Math.max(...reg.invoices.map((i) => daysBetween(i.invoice_date, submittedDay)))
  const care = settings.eligibility.carePlus
  const openCodes = new Set(openFlags.map((f) => f.code))
  const yes = (ok: boolean): VerificationResult => (ok ? "ok" : "issue")

  // What the system can already tell, offered as a starting point. The backend executive confirms every
  // check; only the saved verification counts.
  const suggested: Partial<Record<VerificationKey, VerificationResult>> = {
    product_eligible: yes(careLines.length > 0),
    manufacture_date: yes(reg.invoices.every((i) => i.invoice_date >= care.manufacturedFrom)),
    within_period: yes(oldestInvoiceAge <= care.windowDays),
    dealer: yes(reg.invoices.every((i) => !!i.dealer_id && authorised.get(i.dealer_id) !== false)),
    quantity_matches_invoice: yes(reg.items.every((i) => i.qty_used <= i.qty_purchased)),
    not_already_registered: yes(!openCodes.has("duplicate_invoice") && !openCodes.has("duplicate_invoice_file")),
    no_duplicate: yes(!openCodes.has("site_reused")),
  }
  const saved = reg.verification?.checks as Record<VerificationKey, VerificationResult> | undefined
  const decisionDocs = reg.documents.filter((d) => d.kind === "decision_evidence")

  return (
    <>
      <PageHeader
        back={{ href: "/console/registrations", label: "Registrations" }}
        title={<span className="font-mono">{reg.wrn}</span>}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <RegistrationBadge status={reg.status} audience="staff" />
            {!["active", "rejected", "not_applicable"].includes(reg.status) && <SlaBadge due={reg.sla_due_at} />}
            {reg.channel !== "self" && <Badge variant="outline">Assisted · {reg.channel.replace("_", " ")}</Badge>}
            <span>Submitted {formatDateTime(reg.submitted_at)}</span>
          </span>
        }
      />
      <PageBody>
        {(flags ?? []).length > 0 && (
          <Card className={CONSOLE_CARD}>
            <CardHeader>
              <CardTitle>Checks flagged {openFlags.length > 0 && <Badge variant="destructive">{openFlags.length} open</Badge>}</CardTitle>
              <CardDescription>Automatic duplicate and consistency checks. Review each before deciding.</CardDescription>
            </CardHeader>
            <CardContent>
              <FlagList flags={flags ?? []} canClear={hasRole(staff, ["verifier", "approver"])} />
            </CardContent>
          </Card>
        )}

        <div className="grid gap-3 sm:gap-5 lg:grid-cols-[1.4fr_1fr]">
          <div className="flex min-w-0 flex-col gap-3 sm:gap-5">
            <Card className={CONSOLE_CARD}>
              <CardHeader>
                <CardTitle>Owner and site</CardTitle>
                <CardAction>
                  <Button variant="ghost" size="sm" render={<a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${reg.site_address}, ${reg.city}, ${reg.pincode}`)}`} target="_blank" rel="noreferrer" />} nativeButton={false}>
                    <IconMapPin data-icon="inline-start" />
                    Map
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Owner</dt>
                  <dd>{reg.owner_name}</dd>
                  <dt className="text-muted-foreground">Mobile</dt>
                  <dd>
                    <a href={`tel:+91${reg.owner_mobile}`} className="underline-offset-4 hover:underline">
                      {formatMobile(reg.owner_mobile)}
                    </a>
                  </dd>
                  <dt className="text-muted-foreground">Email</dt>
                  <dd className="break-all">{reg.owner_email}</dd>
                  <dt className="text-muted-foreground">Site</dt>
                  <dd>
                    {reg.site_address}, {reg.city}, {reg.district}, {reg.state} — {reg.pincode}
                  </dd>
                  <dt className="text-muted-foreground">Property</dt>
                  <dd>
                    {label(PROPERTY_TYPES, reg.property_type)} · {label(INSTALLATION_STATUSES, reg.installation_status)}
                  </dd>
                  <dt className="text-muted-foreground">Used in</dt>
                  <dd>{reg.application_areas.join(", ") || "—"}</dd>
                  {reg.carpenter_name && (
                    <>
                      <dt className="text-muted-foreground">Carpenter</dt>
                      <dd>
                        {reg.carpenter_name} {reg.carpenter_mobile && `· ${formatMobile(reg.carpenter_mobile)}`}
                      </dd>
                    </>
                  )}
                  {reg.referred_by && (
                    <>
                      <dt className="text-muted-foreground">Referred by</dt>
                      <dd>
                        {label(REFERRAL_TYPES, reg.referred_by)}: {reg.referrer_name} {reg.referrer_mobile && `· ${formatMobile(reg.referrer_mobile)}`}
                      </dd>
                    </>
                  )}
                </dl>
                {reg.documents.some((d) => d.kind === "site_photo") && (
                  <div className="mt-4 flex flex-col gap-2">
                    <p className="text-sm font-medium">Site photos</p>
                    <DocumentList docs={reg.documents.filter((d) => d.kind === "site_photo")} />
                  </div>
                )}
              </CardContent>
            </Card>

            {reg.invoices.map((inv) => {
              const lines = reg.items.filter((i) => i.invoice_id === inv.id)
              return (
                <Card key={inv.id} className={CONSOLE_CARD}>
                  <CardHeader>
                    <CardTitle>
                      Invoice {inv.invoice_number}
                    </CardTitle>
                    <CardDescription>
                      {formatDate(inv.invoice_date)} · {daysBetween(inv.invoice_date, submittedDay)} days before registration
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium">{inv.dealer_name}</span>
                      {inv.dealer_id ? (
                        authorised.get(inv.dealer_id) ? <Badge variant="secondary">Authorised dealer</Badge> : <Badge variant="destructive">Not authorised</Badge>
                      ) : (
                        <Badge variant="outline">Not on dealer list</Badge>
                      )}
                      {inv.dealer_gstin && <span className="font-mono text-muted-foreground">GSTIN {inv.dealer_gstin}</span>}
                      {inv.dealer_phone && <span className="text-muted-foreground">{formatMobile(inv.dealer_phone)}</span>}
                      {inv.batch_code && <Badge variant="outline">Batch {inv.batch_code}</Badge>}
                    </div>
                    <DocumentList docs={reg.documents.filter((d) => d.invoice_id === inv.id)} />
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">Bought</TableHead>
                          <TableHead className="text-right">At site</TableHead>
                          <TableHead>Warranty</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lines.map((i) => (
                          <TableRow key={i.id}>
                            <TableCell>
                              {i.product_name}
                              <div className="text-xs text-muted-foreground">{categoryLabel(i.category)}</div>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{i.qty_purchased}</TableCell>
                            <TableCell className="text-right tabular-nums">{i.qty_used}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {i.care_plus && <Badge>SylvanCare+</Badge>}
                                {i.standard && <Badge variant="secondary">Standard</Badge>}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )
            })}

            {reg.inspections.length > 0 && (
              <Card className={CONSOLE_CARD}>
                <CardHeader>
                  <CardTitle>Site inspections</CardTitle>
                </CardHeader>
                <CardContent>
                  <ItemGroup className="gap-2">
                    {reg.inspections.map((i) => (
                      <Item key={i.id} variant="outline" size="sm" render={<Link href={`/console/inspections/${i.id}`} />}>
                        <ItemContent>
                          <ItemTitle>
                            {i.staff?.full_name} <Badge variant="secondary">{INSPECTION_STATUS[i.status as keyof typeof INSPECTION_STATUS]}</Badge>
                          </ItemTitle>
                          <ItemDescription>
                            {i.kind === "claim" ? "Claim inspection" : "Registration verification"} ·{" "}
                            {i.submitted_at ? `submitted ${formatDateTime(i.submitted_at)}` : i.scheduled_at ? `scheduled ${formatDateTime(i.scheduled_at)}` : "not scheduled"}
                          </ItemDescription>
                        </ItemContent>
                      </Item>
                    ))}
                  </ItemGroup>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-3 sm:gap-5">
            {reg.care_plus && (
              <Card className={CONSOLE_CARD}>
                <CardHeader>
                  <CardTitle>Backend verification</CardTitle>
                  <CardDescription>
                    {saved && reg.verified_at
                      ? `Verified by ${nameOf.get(reg.verified_by ?? "") ?? "—"} on ${formatDateTime(reg.verified_at)}`
                      : "Not verified yet. Suggestions from the system are shown in grey; the backend executive confirms each check."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="flex flex-col gap-2">
                    {VERIFICATION_CHECKS.map((c) => {
                      const v = saved?.[c.key] ?? suggested[c.key]
                      return <Check key={c.key} ok={v === undefined ? null : v === "ok"} label={c.label} muted={!saved} />
                    })}
                  </ul>
                  {reg.verification?.remarks && <p className="mt-3 text-sm text-muted-foreground">{reg.verification.remarks}</p>}
                  {reg.inspection_needed !== null && (
                    <p className="mt-4 text-sm">
                      <span className="text-muted-foreground">Site inspection: </span>
                      {reg.inspection_needed ? "required" : "not required"}
                      {reg.inspection_reason && ` — ${reg.inspection_reason}`}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {reg.infoRequests.length > 0 && (
              <Card className={CONSOLE_CARD}>
                <CardHeader>
                  <CardTitle>Information requests</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {reg.infoRequests.map((r) => (
                    <div key={r.id} className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
                      <p className="font-medium">{r.requested_items.join(", ")}</p>
                      <p className="text-muted-foreground">{r.remarks}</p>
                      <p className="text-xs text-muted-foreground">Requested {formatDateTime(r.requested_at)}</p>
                      {r.responded_at ? (
                        <>
                          <Badge variant="secondary" className="w-fit">Answered {formatDateTime(r.responded_at)}</Badge>
                          {r.response_note && <p>{r.response_note}</p>}
                          <DocumentList docs={reg.documents.filter((d) => d.info_request_id === r.id)} />
                        </>
                      ) : (
                        <Badge variant="outline" className="w-fit">Waiting for customer</Badge>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {reg.eWarranties.length > 0 && (
              <Card className={CONSOLE_CARD}>
                <CardHeader>
                  <CardTitle>Standard e-warranties</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  {reg.eWarranties.map((e) => (
                    <Item key={e.id} variant="outline" size="sm" render={<Link href={`/console/e-warranties/${e.id}`} />}>
                      <ItemContent>
                        <ItemTitle>
                          {e.program === "LIFETIME" ? "Lifetime" : e.program === "WPC" ? "WPC" : "710 / 303 / BB / FD"} <EWarrantyBadge status={e.status} audience="staff" />
                        </ItemTitle>
                        <ItemDescription>{e.number ?? "Not issued yet"}</ItemDescription>
                      </ItemContent>
                      <IconExternalLink className="size-4 text-muted-foreground" />
                    </Item>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card className={CONSOLE_CARD}>
              <CardHeader>
                <CardTitle>Audit trail</CardTitle>
                <CardDescription>Permanent. Nobody can edit or delete it.</CardDescription>
              </CardHeader>
              <CardContent>
                <Timeline
                  entries={[...reg.audit].reverse().map((a) => ({
                    id: a.id,
                    title: `${a.action.replaceAll("_", " ")}${a.to_status && a.from_status ? ` (${a.from_status.replaceAll("_", " ")} → ${a.to_status.replaceAll("_", " ")})` : ""}`,
                    detail: [a.remarks, (a.data as { reason_label?: string }).reason_label, (a.data as { inspector?: string }).inspector && `Inspector: ${(a.data as { inspector?: string }).inspector}`]
                      .filter(Boolean)
                      .join("\n"),
                    who: a.actor_label,
                    at: a.created_at,
                  }))}
                />
              </CardContent>
            </Card>
            {decisionDocs.length > 0 && (
              <Card className={CONSOLE_CARD}>
                <CardHeader>
                  <CardTitle>Decision documents</CardTitle>
                  <CardDescription>Supporting photographs and documents attached by the approver.</CardDescription>
                </CardHeader>
                <CardContent>
                  <DocumentList docs={decisionDocs} />
                </CardContent>
              </Card>
            )}
            {reg.created_by_staff && <p className="px-4 text-xs text-muted-foreground sm:px-0">Assisted registration created by {nameOf.get(reg.created_by_staff)}</p>}
            {reg.claim && (
              <Button variant="outline" render={<Link href={`/console/claims/${toSlug(reg.claim.claim_no)}`} />} nativeButton={false}>
                Open claim {reg.claim.claim_no}
              </Button>
            )}
            {!reg.claim && reg.status === "active" && hasRole(staff, ["customer_care"]) && (
              <Button variant="outline" className="max-sm:mx-4" render={<Link href={`/console/registrations/${ref}/complaint`} />} nativeButton={false}>
                <IconMessageReport data-icon="inline-start" />
                Raise complaint for customer
              </Button>
            )}
          </div>
        </div>

        <RegistrationActions
          id={reg.id}
          status={reg.status}
          roles={staff.roles}
          inspectors={inspectorOptions}
          rejectReasons={(reasons ?? []).filter((r) => r.context === "registration_reject").map((r) => ({ value: r.code, label: r.label }))}
          noInspectionReasons={(reasons ?? []).filter((r) => r.context === "no_inspection").map((r) => ({ value: r.code, label: r.label }))}
          checks={saved ?? suggested}
          verified={!!reg.verified_at}
        />
      </PageBody>
    </>
  )
}
