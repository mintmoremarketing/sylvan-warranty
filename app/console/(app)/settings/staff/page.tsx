import type { Metadata } from "next"

import { CONSOLE_CARD, PageBody, PageHeader } from "@/components/console/page-header"
import { StaffCreate, StaffEdit } from "@/components/console/settings-forms"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item"
import { requireStaff } from "@/lib/auth"
import { ROLE_LABELS, type Role } from "@/lib/domain/constants"
import { supabaseAdmin } from "@/lib/supabase/admin"

export const metadata: Metadata = { title: "Staff & roles" }

export default async function StaffSettings() {
  await requireStaff(["admin"], "/console/settings/staff")
  const { data } = await supabaseAdmin().from("staff").select("id, full_name, email, designation, roles, regions, active").order("full_name")
  return (
    <>
      <PageHeader title="Staff & roles" description="Who can use the console, and what they can do. Role-based access is enforced on every action." actions={<StaffCreate />} />
      <PageBody>
        <Card className={CONSOLE_CARD}>
          <CardContent>
            <ItemGroup className="gap-2">
              {(data ?? []).map((s) => (
                <Item key={s.id} variant="outline" size="sm" className={s.active ? "" : "opacity-60"}>
                  <ItemContent>
                    <ItemTitle className="flex-wrap">
                      {s.full_name}
                      {!s.active && <Badge variant="outline">Inactive</Badge>}
                    </ItemTitle>
                    <ItemDescription className="line-clamp-none">
                      {s.email}
                      {s.designation && ` · ${s.designation}`}
                      {(s.regions as string[]).length > 0 && ` · ${(s.regions as string[]).join(", ")}`}
                    </ItemDescription>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {(s.roles as Role[]).map((r) => (
                        <Badge key={r} variant="secondary">
                          {ROLE_LABELS[r]}
                        </Badge>
                      ))}
                    </div>
                  </ItemContent>
                  <ItemActions>
                    <StaffEdit staff={{ id: s.id, full_name: s.full_name, designation: s.designation, roles: s.roles as string[], regions: s.regions as string[], active: s.active }} />
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
