import type { Metadata } from "next"
import Link from "next/link"
import { IconFlag } from "@tabler/icons-react"

import { CONSOLE_CARD, PageBody, PageHeader } from "@/components/console/page-header"
import { QueueControls } from "@/components/console/queue-controls"
import { RegistrationBadge, SlaBadge } from "@/components/status"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { requireStaff } from "@/lib/auth"
import { REGISTRATION_QUEUES } from "@/lib/domain/constants"
import { formatDate } from "@/lib/domain/dates"
import { formatMobile } from "@/lib/domain/format"
import { toSlug } from "@/lib/domain/numbers"
import { supabaseAdmin } from "@/lib/supabase/admin"

export const metadata: Metadata = { title: "Registrations" }

type Row = {
  id: string
  wrn: string
  owner_name: string
  owner_mobile: string
  city: string
  state: string
  status: string
  care_plus: boolean
  channel: string
  sla_due_at: string | null
  submitted_at: string
  registration_items: { product_name: string; qty_used: number; care_plus: boolean }[]
  fraud_flags: { severity: string; status: string }[]
}

export default async function RegistrationsQueue({ searchParams }: { searchParams: Promise<{ q?: string; s?: string }> }) {
  await requireStaff(["verifier", "approver", "customer_care", "management"], "/console/registrations")
  const { q = "all", s = "" } = await searchParams
  const queue = REGISTRATION_QUEUES.find((x) => x.key === q) ?? REGISTRATION_QUEUES[0]
  const search = s.trim()

  let query = supabaseAdmin()
    .from("registrations")
    .select("id, wrn, owner_name, owner_mobile, city, state, status, care_plus, channel, sla_due_at, submitted_at, registration_items(product_name, qty_used, care_plus), fraud_flags(severity, status)")
    .order("submitted_at", { ascending: queue.key !== "all" && queue.key !== "active" && queue.key !== "rejected" })
    .limit(100)
  if (queue.statuses.length) query = query.in("status", [...queue.statuses])
  if (search) {
    const term = search.replace(/[%,()]/g, "")
    const digits = term.replace(/\D/g, "")
    const { data: inv } = await supabaseAdmin()
      .from("registration_invoices")
      .select("registration_id")
      .ilike("invoice_number", `%${term}%`)
      .limit(50)
    const ors = [`wrn.ilike.%${term}%`, `owner_name.ilike.%${term}%`, `owner_email.ilike.%${term}%`, `city.ilike.%${term}%`]
    if (digits.length >= 4) ors.push(`owner_mobile.ilike.%${digits}%`, `pincode.ilike.%${digits}%`)
    if (inv?.length) ors.push(`id.in.(${inv.map((i) => i.registration_id).join(",")})`)
    query = query.or(ors.join(","))
  }
  const { data } = await query
  const rows = (data ?? []) as unknown as Row[]

  const flagsOf = (r: Row) => r.fraud_flags.filter((f) => f.status === "open" && f.severity !== "info").length
  const products = (r: Row) => [...new Set(r.registration_items.map((i) => i.product_name))].join(", ")

  return (
    <>
      <PageHeader title="Registrations" description="Verify invoices and site details, decide on inspections, and approve SylvanCare+ warranties.">
        <QueueControls basePath="/console/registrations" tabs={REGISTRATION_QUEUES} current={queue.key} search={search} placeholder="Search WRN, name, mobile, pincode or invoice no." />
      </PageHeader>
      <PageBody>
        <Card className={CONSOLE_CARD}>
          <CardContent>
            {rows.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>Nothing here</EmptyTitle>
                  <EmptyDescription>{search ? "No registrations match your search." : "This queue is empty."}</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <>
                <ItemGroup className="gap-2 md:hidden">
                  {rows.map((r) => (
                    <Item key={r.id} variant="outline" render={<Link href={`/console/registrations/${toSlug(r.wrn)}`} />} className="items-start">
                      <ItemContent>
                        <ItemTitle className="font-mono">{r.wrn}</ItemTitle>
                        <ItemDescription className="line-clamp-none">
                          {r.owner_name} · {r.city}
                          <br />
                          {products(r)}
                        </ItemDescription>
                        <div className="flex flex-wrap gap-1 pt-1">
                          <RegistrationBadge status={r.status} audience="staff" />
                          <SlaBadge due={r.status === "active" || r.status === "rejected" ? null : r.sla_due_at} />
                          {flagsOf(r) > 0 && (
                            <Badge variant="destructive">
                              <IconFlag data-icon="inline-start" />
                              {flagsOf(r)}
                            </Badge>
                          )}
                        </div>
                      </ItemContent>
                      <ItemActions className="text-xs text-muted-foreground">{formatDate(r.submitted_at)}</ItemActions>
                    </Item>
                  ))}
                </ItemGroup>
                <Table className="hidden md:table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>WRN</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Products</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>SLA</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.id} className="relative cursor-pointer">
                        <TableCell>
                          <Link href={`/console/registrations/${toSlug(r.wrn)}`} className="font-mono font-medium after:absolute after:inset-0 hover:underline">
                            {r.wrn}
                          </Link>
                          {r.channel !== "self" && <div className="text-xs text-muted-foreground">Assisted ({r.channel.replace("_", " ")})</div>}
                        </TableCell>
                        <TableCell>
                          {r.owner_name}
                          <div className="text-xs text-muted-foreground">
                            {formatMobile(r.owner_mobile)} · {r.city}, {r.state}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-56 truncate">{products(r)}</TableCell>
                        <TableCell>{formatDate(r.submitted_at)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            <RegistrationBadge status={r.status} audience="staff" />
                            {flagsOf(r) > 0 && (
                              <Badge variant="destructive">
                                <IconFlag data-icon="inline-start" />
                                {flagsOf(r)}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <SlaBadge due={r.status === "active" || r.status === "rejected" ? null : r.sla_due_at} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </CardContent>
        </Card>
      </PageBody>
    </>
  )
}
