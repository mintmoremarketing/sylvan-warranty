import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { IconDownload } from "@tabler/icons-react"

import { EWarrantyEditor } from "@/components/console/e-warranty-editor"
import { CONSOLE_CARD, PageBody, PageHeader } from "@/components/console/page-header"
import { DocumentList } from "@/components/document-list"
import { EWarrantyBadge, Timeline } from "@/components/status"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { hasRole, requireStaff } from "@/lib/auth"
import { categoryLabel } from "@/lib/domain/constants"
import { formatDate, formatDateTime } from "@/lib/domain/dates"
import { formatMobile } from "@/lib/domain/format"
import { toSlug } from "@/lib/domain/numbers"
import { loadRegistration } from "@/lib/queries"
import { getAllProducts } from "@/lib/settings"
import { supabaseAdmin } from "@/lib/supabase/admin"

export const metadata: Metadata = { title: "E-warranty" }

export default async function EWarrantyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const staff = await requireStaff(["sales_coordinator", "management"], `/console/e-warranties/${id}`)
  const db = supabaseAdmin()
  const { data: row } = await db.from("e_warranties").select("registration_id, coordinator_id, issued_by, registrations(wrn), warranty_programs(name, certificate_title)").eq("id", id).maybeSingle()
  if (!row) notFound()
  if (row.coordinator_id !== staff.id && !hasRole(staff, ["management"])) notFound()

  const reg = (await loadRegistration((row.registrations as unknown as { wrn: string }).wrn))!
  const ew = reg.eWarranties.find((e) => e.id === id)!
  const program = row.warranty_programs as unknown as { name: string; certificate_title: string }
  const [products, { data: coordinators }, { data: events }, { data: issuer }] = await Promise.all([
    getAllProducts(),
    db.from("staff").select("id, full_name").contains("roles", ["sales_coordinator"]).eq("active", true),
    db.from("audit_events").select("*").eq("e_warranty_id", id).order("created_at", { ascending: false }),
    row.issued_by ? db.from("staff").select("full_name").eq("id", row.issued_by).single() : Promise.resolve({ data: null }),
  ])
  const editable = ew.status === "pending_review" && (row.coordinator_id === staff.id || hasRole(staff, ["admin"]))

  return (
    <>
      <PageHeader
        back={{ href: "/console/e-warranties", label: "E-warranties" }}
        title={ew.number ?? program.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <EWarrantyBadge status={ew.status} audience="staff" />
            <span>{program.certificate_title}</span>
          </span>
        }
        actions={
          ew.status === "issued" ? (
            <Button variant="outline" render={<a href={`/api/certificates/e-warranty/${id}`} target="_blank" />} nativeButton={false}>
              <IconDownload data-icon="inline-start" />
              Certificate
            </Button>
          ) : undefined
        }
      />
      <PageBody>
        <Card className={CONSOLE_CARD}>
          <CardHeader>
            <CardTitle>Invoice and registration</CardTitle>
            <CardDescription>
              From <Link href={`/console/registrations/${toSlug(reg.wrn)}`} className="font-mono underline underline-offset-4">{reg.wrn}</Link>, submitted {formatDateTime(reg.submitted_at)}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <p>
              {reg.owner_name} · {formatMobile(reg.owner_mobile)} · {reg.owner_email}
            </p>
            {reg.invoices.map((inv) => (
              <div key={inv.id} className="flex flex-col gap-2">
                <p className="text-muted-foreground">
                  Invoice {inv.invoice_number} · {formatDate(inv.invoice_date)} · {inv.dealer_name}
                </p>
                <DocumentList docs={reg.documents.filter((d) => d.invoice_id === inv.id)} />
              </div>
            ))}
          </CardContent>
        </Card>

        {editable ? (
          <EWarrantyEditor
            id={id}
            initial={{
              customer_name: ew.customer_name,
              customer_mobile: ew.customer_mobile,
              customer_address: ew.customer_address,
              dealer_name: ew.dealer_name,
              invoice_number: ew.invoice_number,
              invoice_date: ew.invoice_date,
              coordinator_id: ew.coordinator_id ?? "",
            }}
            items={ew.e_warranty_items.map((i) => ({ id: i.id, product_id: i.product_id, qty: i.qty, category: i.category, invoice_number: i.invoice_number }))}
            products={products.filter((p) => p.standard_program === ew.program).map((p) => ({ id: p.id, name: p.name, category: p.category }))}
            coordinators={(coordinators ?? []).map((c) => ({ value: c.id, label: c.full_name }))}
            isWpc={ew.program === "WPC"}
            canAssign={hasRole(staff, ["admin"])}
          />
        ) : (
          <Card className={CONSOLE_CARD}>
            <CardHeader>
              <CardTitle>{ew.status === "issued" ? "Issued certificate" : "Details"}</CardTitle>
              {ew.status === "issued" && (
                <CardDescription>
                  Issued {formatDateTime(ew.issued_at)} by {issuer?.full_name}
                </CardDescription>
              )}
              {ew.status === "rejected" && <CardDescription>Not issued: {ew.reject_reason}</CardDescription>}
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <p>
                {ew.customer_name} · {formatMobile(ew.customer_mobile)}
                <br />
                {ew.customer_address}
                <br />
                Dealer: {ew.dealer_name} · Invoice {ew.invoice_number} ({formatDate(ew.invoice_date)})
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Warranty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ew.e_warranty_items.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell>
                        {i.product_name}
                        <div className="text-xs text-muted-foreground">{categoryLabel(i.category)}</div>
                      </TableCell>
                      <TableCell>{i.qty}</TableCell>
                      <TableCell>{i.warranty_period}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <Card className={CONSOLE_CARD}>
          <CardHeader>
            <CardTitle>History</CardTitle>
          </CardHeader>
          <CardContent>
            <Timeline
              entries={(events ?? []).map((e) => ({
                id: e.id,
                title: e.action.replaceAll("_", " "),
                detail: [e.remarks, e.data?.changed && Object.keys(e.data.changed).length ? `Changed: ${Object.keys(e.data.changed).join(", ").replaceAll("_", " ")}` : null, e.data?.number].filter(Boolean).join("\n"),
                who: e.actor_label,
                at: e.created_at,
              }))}
            />
          </CardContent>
        </Card>
      </PageBody>
    </>
  )
}
