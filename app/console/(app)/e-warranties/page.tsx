import type { Metadata } from "next"
import Link from "next/link"

import { CONSOLE_CARD, PageBody, PageHeader } from "@/components/console/page-header"
import { QueueControls } from "@/components/console/queue-controls"
import { EWarrantyBadge } from "@/components/status"
import { Card, CardContent } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item"
import { hasRole, requireStaff } from "@/lib/auth"
import { formatDate } from "@/lib/domain/dates"
import { supabaseAdmin } from "@/lib/supabase/admin"

export const metadata: Metadata = { title: "E-warranties" }

const TABS = [
  { key: "pending", label: "To review", statuses: ["pending_review"] },
  { key: "issued", label: "Issued", statuses: ["issued"] },
  { key: "rejected", label: "Not issued", statuses: ["rejected"] },
  { key: "all", label: "All", statuses: [] as string[] },
]

type Row = {
  id: string
  number: string | null
  status: "pending_review" | "issued" | "rejected"
  customer_name: string
  dealer_name: string
  invoice_number: string
  created_at: string
  warranty_programs: { name: string }
  registrations: { wrn: string; city: string }
  e_warranty_items: { product_name: string; qty: number }[]
  coordinator: { full_name: string } | null
}

export default async function EWarrantiesPage({ searchParams }: { searchParams: Promise<{ q?: string; s?: string }> }) {
  const staff = await requireStaff(["sales_coordinator", "management"], "/console/e-warranties")
  const { q = "pending", s = "" } = await searchParams
  const tab = TABS.find((t) => t.key === q) ?? TABS[0]
  const seeAll = hasRole(staff, ["management"])

  let query = supabaseAdmin()
    .from("e_warranties")
    .select("id, number, status, customer_name, dealer_name, invoice_number, created_at, warranty_programs(name), registrations!inner(wrn, city), e_warranty_items(product_name, qty), coordinator:coordinator_id(full_name)")
    .order("created_at", { ascending: tab.key === "pending" })
    .limit(100)
  if (!seeAll) query = query.or(`coordinator_id.eq.${staff.id},coordinator_id.is.null`)
  if (tab.statuses.length) query = query.in("status", tab.statuses)
  if (s.trim()) {
    const term = s.trim().replace(/[%,()]/g, "")
    query = query.or(`customer_name.ilike.%${term}%,dealer_name.ilike.%${term}%,invoice_number.ilike.%${term}%,number.ilike.%${term}%`)
  }
  const { data } = await query
  const rows = (data ?? []) as unknown as Row[]

  return (
    <>
      <PageHeader title="Standard e-warranties" description={seeAll ? "All e-warranty requests across coordinators." : "E-warranty requests assigned to you or not yet picked up. Check each product, correct and issue."}>
        <QueueControls basePath="/console/e-warranties" tabs={TABS} current={tab.key} search={s} placeholder="Search customer, dealer, invoice or certificate no." />
      </PageHeader>
      <PageBody>
        <Card className={CONSOLE_CARD}>
          <CardContent>
            {rows.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>Nothing to review</EmptyTitle>
                  <EmptyDescription>New e-warranty requests from registrations appear here.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ItemGroup className="gap-2">
                {rows.map((r) => (
                  <Item key={r.id} variant="outline" render={<Link href={`/console/e-warranties/${r.id}`} />} className="items-start">
                    <ItemContent>
                      <ItemTitle>
                        {r.customer_name} · {r.registrations.city}
                      </ItemTitle>
                      <ItemDescription className="line-clamp-none">
                        {r.e_warranty_items.map((i) => `${i.product_name} × ${i.qty}`).join(", ")} · {r.dealer_name} · inv {r.invoice_number}
                        {seeAll && r.coordinator && ` · ${r.coordinator.full_name}`}
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions className="flex-col items-end gap-1">
                      <EWarrantyBadge status={r.status} audience="staff" />
                      <span className="text-xs text-muted-foreground">{r.number ?? formatDate(r.created_at)}</span>
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
