import type { Metadata } from "next"
import Link from "next/link"

import { CONSOLE_CARD, PageBody, PageHeader } from "@/components/console/page-header"
import { QueueControls } from "@/components/console/queue-controls"
import { ClaimBadge, SlaBadge } from "@/components/status"
import { Card, CardContent } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { requireStaff } from "@/lib/auth"
import { CLAIM_QUEUES } from "@/lib/domain/constants"
import { formatDate } from "@/lib/domain/dates"
import { toSlug } from "@/lib/domain/numbers"
import { supabaseAdmin } from "@/lib/supabase/admin"

export const metadata: Metadata = { title: "Claims" }

type Row = {
  id: string
  claim_no: string
  status: string
  complaint_type: string
  affected_qty: number
  sla_due_at: string | null
  submitted_at: string
  registrations: { owner_name: string; city: string; state: string }
  registration_items: { product_name: string }
}

export default async function ClaimsQueue({ searchParams }: { searchParams: Promise<{ q?: string; s?: string }> }) {
  await requireStaff(["verifier", "technical", "approver", "finance", "customer_care", "management"], "/console/claims")
  const { q = "screening", s = "" } = await searchParams
  const queue = CLAIM_QUEUES.find((x) => x.key === q) ?? CLAIM_QUEUES[0]

  let query = supabaseAdmin()
    .from("claims")
    .select("id, claim_no, status, complaint_type, affected_qty, sla_due_at, submitted_at, registrations!inner(owner_name, city, state), registration_items(product_name)")
    .order("submitted_at", { ascending: false })
    .limit(100)
  if (queue.statuses.length) query = query.in("status", [...queue.statuses])
  if (s.trim()) {
    const term = s.trim().replace(/[%,()]/g, "")
    query = query.or(`claim_no.ilike.%${term}%,complaint_type.ilike.%${term}%`)
  }
  const { data } = await query
  const rows = (data ?? []) as unknown as Row[]
  const open = (st: string) => !["closed", "rejected", "settlement_completed"].includes(st)

  return (
    <>
      <PageHeader title="Claims" description="Pre-screen complaints, arrange inspections and testing, decide, compensate and settle.">
        <QueueControls basePath="/console/claims" tabs={CLAIM_QUEUES} current={queue.key} search={s} placeholder="Search claim ID or complaint type" />
      </PageHeader>
      <PageBody>
        <Card className={CONSOLE_CARD}>
          <CardContent>
            {rows.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>No claims here</EmptyTitle>
                  <EmptyDescription>Complaints raised by customers will appear in this queue.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <>
                <ItemGroup className="gap-2 md:hidden">
                  {rows.map((r) => (
                    <Item key={r.id} variant="outline" render={<Link href={`/console/claims/${toSlug(r.claim_no)}`} />} className="items-start">
                      <ItemContent>
                        <ItemTitle className="font-mono text-xs">{r.claim_no}</ItemTitle>
                        <ItemDescription className="line-clamp-none">
                          {r.registrations.owner_name} · {r.registrations.city}
                          <br />
                          {r.complaint_type} · {r.registration_items.product_name} · {r.affected_qty} sheets
                        </ItemDescription>
                        <div className="flex flex-wrap gap-1 pt-1">
                          <ClaimBadge status={r.status} audience="staff" />
                          {open(r.status) && <SlaBadge due={r.sla_due_at} />}
                        </div>
                      </ItemContent>
                      <ItemActions className="text-xs text-muted-foreground">{formatDate(r.submitted_at)}</ItemActions>
                    </Item>
                  ))}
                </ItemGroup>
                <Table className="hidden md:table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Claim ID</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Complaint</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <Link href={`/console/claims/${toSlug(r.claim_no)}`} className="font-mono font-medium hover:underline">
                            {r.claim_no}
                          </Link>
                        </TableCell>
                        <TableCell>
                          {r.registrations.owner_name}
                          <div className="text-xs text-muted-foreground">
                            {r.registrations.city}, {r.registrations.state}
                          </div>
                        </TableCell>
                        <TableCell>
                          {r.complaint_type}
                          <div className="text-xs text-muted-foreground">
                            {r.registration_items.product_name} · {r.affected_qty} sheets
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(r.submitted_at)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            <ClaimBadge status={r.status} audience="staff" />
                            {open(r.status) && <SlaBadge due={r.sla_due_at} />}
                          </div>
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
