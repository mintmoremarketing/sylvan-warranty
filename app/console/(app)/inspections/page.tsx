import type { Metadata } from "next"
import Link from "next/link"

import { CONSOLE_CARD, PageBody, PageHeader } from "@/components/console/page-header"
import { QueueControls } from "@/components/console/queue-controls"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item"
import { hasRole, requireStaff } from "@/lib/auth"
import { INSPECTION_STATUS } from "@/lib/domain/constants"
import { formatDateTime } from "@/lib/domain/dates"
import { supabaseAdmin } from "@/lib/supabase/admin"

export const metadata: Metadata = { title: "Inspections" }

const TABS = [
  { key: "open", label: "Open", statuses: ["assigned", "scheduled", "revisit_required"] },
  { key: "done", label: "Submitted", statuses: ["completed"] },
  { key: "all", label: "All", statuses: [] as string[] },
]

type Row = {
  id: string
  kind: string
  status: keyof typeof INSPECTION_STATUS
  scheduled_at: string | null
  submitted_at: string | null
  registrations: { wrn: string; owner_name: string; site_address: string; city: string; pincode: string }
  claims: { claim_no: string } | null
  staff: { full_name: string }
}

export default async function InspectionsPage({ searchParams }: { searchParams: Promise<{ q?: string; s?: string }> }) {
  const staff = await requireStaff(["inspector", "verifier", "technical"], "/console/inspections")
  const { q = "open", s = "" } = await searchParams
  const tab = TABS.find((t) => t.key === q) ?? TABS[0]
  const seeAll = hasRole(staff, ["verifier", "technical"])

  let query = supabaseAdmin()
    .from("inspections")
    .select("id, kind, status, scheduled_at, submitted_at, registrations!inner(wrn, owner_name, site_address, city, pincode), claims(claim_no), staff:inspector_id(full_name)")
    .order("scheduled_at", { ascending: true, nullsFirst: false })
    .limit(100)
  if (!seeAll) query = query.eq("inspector_id", staff.id)
  if (tab.statuses.length) query = query.in("status", tab.statuses)
  else query = query.neq("status", "cancelled")
  if (s.trim()) {
    const term = s.trim().replace(/[%,()]/g, "")
    query = query.or(`wrn.ilike.%${term}%,owner_name.ilike.%${term}%,city.ilike.%${term}%,pincode.ilike.%${term}%`, { referencedTable: "registrations" })
  }
  const { data } = await query
  const rows = (data ?? []) as unknown as Row[]

  return (
    <>
      <PageHeader title={seeAll ? "Inspections" : "My inspections"} description="Site verification visits for registrations, and inspections for claims.">
        <QueueControls basePath="/console/inspections" tabs={TABS} current={tab.key} search={s} placeholder="Search WRN, owner, city or pincode" />
      </PageHeader>
      <PageBody>
        <Card className={CONSOLE_CARD}>
          <CardContent>
            {rows.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>No inspections</EmptyTitle>
                  <EmptyDescription>Assigned visits will appear here.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ItemGroup className="gap-2">
                {rows.map((r) => (
                  <Item key={r.id} variant="outline" render={<Link href={`/console/inspections/${r.id}`} />} className="items-start">
                    <ItemContent>
                      <ItemTitle>
                        {r.registrations.owner_name} · {r.registrations.city}
                      </ItemTitle>
                      <ItemDescription className="line-clamp-none">
                        {r.registrations.site_address}, {r.registrations.pincode}
                        <br />
                        <span className="font-mono">{r.claims?.claim_no ?? r.registrations.wrn}</span> · {r.kind === "claim" ? "Claim inspection" : "Registration verification"}
                        {seeAll && ` · ${r.staff.full_name}`}
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions className="flex-col items-end gap-1">
                      <Badge variant={r.status === "revisit_required" ? "destructive" : r.status === "completed" ? "default" : "secondary"}>{INSPECTION_STATUS[r.status]}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {r.submitted_at ? formatDateTime(r.submitted_at) : r.scheduled_at ? formatDateTime(r.scheduled_at) : "Not scheduled"}
                      </span>
                    </ItemActions>
                  </Item>
                ))}
              </ItemGroup>
            )}
          </CardContent>
        </Card>
      </PageBody>
    </>
  )
}
