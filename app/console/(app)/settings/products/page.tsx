import type { Metadata } from "next"
import { IconAlertTriangle } from "@tabler/icons-react"

import { CONSOLE_CARD, PageBody, PageHeader } from "@/components/console/page-header"
import { ProductEdit } from "@/components/console/settings-forms"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item"
import { requireStaff } from "@/lib/auth"
import { categoryLabel } from "@/lib/domain/constants"
import { getAllProducts } from "@/lib/settings"
import { supabaseAdmin } from "@/lib/supabase/admin"

export const metadata: Metadata = { title: "Products" }

export default async function ProductSettings() {
  await requireStaff(["admin"], "/console/settings/products")
  const [products, { data: programs }] = await Promise.all([getAllProducts(), supabaseAdmin().from("warranty_programs").select("code, name").eq("kind", "standard").order("sort")])
  const missingMultiplier = products.filter((p) => p.standard_program === "LIFETIME" && !p.lifetime_multiplier).length

  return (
    <>
      <PageHeader title="Products" description="Warranty programme, standard period, Lifetime multiplier and SylvanCare+ tenure for each product." />
      <PageBody>
        {missingMultiplier > 0 && (
          <Alert className="max-sm:mx-4 max-sm:w-auto">
            <IconAlertTriangle />
            <AlertTitle>Waiting on Sylvan</AlertTitle>
            <AlertDescription>
              {missingMultiplier} Lifetime products have no multiplier (2.5× / 5× / 7.5× / 10×) yet, and the 30-year period for the 710/303/BB/FD range is provisional.
            </AlertDescription>
          </Alert>
        )}
        {(programs ?? []).map((prog) => (
          <Card key={prog.code} className={CONSOLE_CARD}>
            <CardHeader>
              <CardTitle>{prog.name}</CardTitle>
              <CardDescription>Standard e-warranty certificate group</CardDescription>
            </CardHeader>
            <CardContent>
              <ItemGroup className="gap-2">
                {products
                  .filter((p) => p.standard_program === prog.code)
                  .map((p) => (
                    <Item key={p.id} variant="outline" size="sm" className={p.active ? "" : "opacity-60"}>
                      <ItemContent>
                        <ItemTitle className="flex-wrap">
                          {p.name}
                          <Badge variant="outline">{categoryLabel(p.category)}</Badge>
                          {p.care_plus_years && <Badge>SylvanCare+ {p.care_plus_years} yrs</Badge>}
                          {!p.active && <Badge variant="outline">Hidden</Badge>}
                        </ItemTitle>
                        <ItemDescription>
                          Standard: {p.standard_period ?? "—"}
                          {prog.code === "LIFETIME" && ` · multiplier ${p.lifetime_multiplier ?? "pending"}`}
                          {p.coverage_note && ` · ${p.coverage_note}`}
                        </ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        <ProductEdit product={p} />
                      </ItemActions>
                    </Item>
                  ))}
              </ItemGroup>
            </CardContent>
          </Card>
        ))}
      </PageBody>
    </>
  )
}
