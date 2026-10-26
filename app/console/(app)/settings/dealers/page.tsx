import type { Metadata } from "next"

import { CONSOLE_CARD, PageBody, PageHeader } from "@/components/console/page-header"
import { DealerEdit, DealerImport } from "@/components/console/settings-forms"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item"
import { requireStaff } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase/admin"

export const metadata: Metadata = { title: "Dealers" }

export default async function DealerSettings() {
  await requireStaff(["admin"], "/console/settings/dealers")
  const db = supabaseAdmin()
  const [{ data: dealers }, { data: coordinators }] = await Promise.all([
    db.from("dealers").select("id, code, name, city, state, gstin, phone, authorised, active, sales_coordinator_id, coordinator:sales_coordinator_id(full_name)").order("name"),
    db.from("staff").select("id, full_name").contains("roles", ["sales_coordinator"]).eq("active", true).order("full_name"),
  ])
  const coordOptions = (coordinators ?? []).map((c) => ({ value: c.id, label: c.full_name }))

  return (
    <>
      <PageHeader
        title="Dealers"
        description="Authorised dealers appear in the registration form; invoices from unlisted dealers are flagged for verification."
        actions={
          <>
            <DealerImport />
            <DealerEdit coordinators={coordOptions} />
          </>
        }
      />
      <PageBody>
        <Card className={CONSOLE_CARD}>
          <CardContent>
            <ItemGroup className="gap-2">
              {(dealers ?? []).map((d) => (
                <Item key={d.id} variant="outline" size="sm" className={d.active ? "" : "opacity-60"}>
                  <ItemContent>
                    <ItemTitle className="flex-wrap">
                      {d.name}
                      {!d.authorised && <Badge variant="destructive">Not authorised</Badge>}
                      {!d.active && <Badge variant="outline">Hidden</Badge>}
                    </ItemTitle>
                    <ItemDescription className="line-clamp-none">
                      {[d.code, d.city, d.state, d.gstin && `GSTIN ${d.gstin}`].filter(Boolean).join(" · ")}
                      <br />
                      Coordinator: {(d.coordinator as unknown as { full_name: string } | null)?.full_name ?? "unassigned"}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <DealerEdit
                      coordinators={coordOptions}
                      dealer={{
                        id: d.id,
                        code: d.code ?? "",
                        name: d.name,
                        city: d.city ?? "",
                        state: d.state ?? "",
                        gstin: d.gstin ?? "",
                        phone: d.phone ?? "",
                        coordinator_id: d.sales_coordinator_id ?? "",
                        authorised: d.authorised,
                        active: d.active,
                      }}
                    />
                  </ItemActions>
                </Item>
              ))}
            </ItemGroup>
          </CardContent>
        </Card>
      </PageBody>
    </>
  )
}
