import type { Metadata } from "next"
import { IconCircleCheck, IconCircleX } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { categoryLabel } from "@/lib/domain/constants"
import { formatDate } from "@/lib/domain/dates"
import { maskName } from "@/lib/domain/format"
import { fromSlug } from "@/lib/domain/numbers"
import { supabaseAdmin } from "@/lib/supabase/admin"

export const metadata: Metadata = { title: "Verify a certificate", robots: { index: false } }

type Row = { product: string; category: string; qty: number; validity: string }

async function lookup(ref: string) {
  const db = supabaseAdmin()
  if (ref.startsWith("WRN/")) {
    const { data } = await db
      .from("registrations")
      .select("wrn, owner_name, city, state, status, claim_locked_at, registration_items(product_name, category, qty_used, care_plus, care_start, care_expiry)")
      .eq("wrn", ref)
      .maybeSingle()
    if (!data || data.status !== "active") return null
    const rows: Row[] = (data.registration_items as { product_name: string; category: string; qty_used: number; care_plus: boolean; care_start: string; care_expiry: string }[])
      .filter((i) => i.care_plus)
      .map((i) => ({ product: i.product_name, category: i.category, qty: i.qty_used, validity: `${formatDate(i.care_start)} – ${formatDate(i.care_expiry)}` }))
    return {
      title: "SylvanCare+ warranty",
      number: data.wrn,
      owner: data.owner_name,
      place: `${data.city}, ${data.state}`,
      note: data.claim_locked_at ? "A claim has been registered against this warranty." : null,
      rows,
    }
  }
  const { data } = await db
    .from("e_warranties")
    .select("number, customer_name, status, issued_at, warranty_programs(name), e_warranty_items(product_name, category, qty, warranty_period), registrations(city, state)")
    .eq("number", ref)
    .maybeSingle()
  if (!data || data.status !== "issued") return null
  const program = data.warranty_programs as unknown as { name: string } | null
  const reg = data.registrations as unknown as { city: string; state: string } | null
  return {
    title: `Sylvan e-warranty — ${program?.name ?? ""}`,
    number: data.number!,
    owner: data.customer_name,
    place: reg ? `${reg.city}, ${reg.state}` : "",
    note: `Issued on ${formatDate(data.issued_at)}`,
    rows: (data.e_warranty_items as { product_name: string; category: string; qty: number; warranty_period: string }[]).map((i) => ({
      product: i.product_name,
      category: i.category,
      qty: i.qty,
      validity: i.warranty_period,
    })),
  }
}

export default async function VerifyPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params
  const number = fromSlug(ref)
  const result = await lookup(number)

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10 sm:py-14">
      <h1 className="text-2xl font-semibold tracking-tight">Certificate verification</h1>
      {result ? (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-primary">
              <IconCircleCheck className="size-6" />
              <span className="font-medium">Genuine Sylvan certificate</span>
            </div>
            <CardTitle className="text-xl">{result.title}</CardTitle>
            <CardDescription>
              <span className="font-mono">{result.number}</span> · issued to {maskName(result.owner)}
              {result.place && ` · ${result.place}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {result.note && <Badge variant="secondary">{result.note}</Badge>}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Warranty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((r) => (
                  <TableRow key={r.product + r.category}>
                    <TableCell>
                      {r.product}
                      <div className="text-xs text-muted-foreground">{categoryLabel(r.category)}</div>
                    </TableCell>
                    <TableCell>{r.qty}</TableCell>
                    <TableCell className="whitespace-normal">{r.validity}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex items-start gap-3">
            <IconCircleX className="size-6 shrink-0 text-destructive" />
            <div>
              <p className="font-medium">We couldn&apos;t verify {number}</p>
              <p className="text-sm text-muted-foreground">
                The number doesn&apos;t match an active Sylvan certificate. Check the number on the certificate, or contact reach@sylvanply.com.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  )
}
