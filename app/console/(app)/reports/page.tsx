import type { Metadata } from "next"
import { IconDownload } from "@tabler/icons-react"

import { CONSOLE_CARD, PageBody, PageHeader } from "@/components/console/page-header"
import { ReportBarChart } from "@/components/console/report-chart"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { requireStaff } from "@/lib/auth"
import { REGISTRATION_STATUS, type RegistrationStatus } from "@/lib/domain/constants"
import { formatINR } from "@/lib/domain/format"
import { supabaseAdmin } from "@/lib/supabase/admin"

export const metadata: Metadata = { title: "Reports" }

const tally = <T,>(rows: T[], key: (r: T) => string | null | undefined, weight: (r: T) => number = () => 1) => {
  const m = new Map<string, number>()
  for (const r of rows) {
    const k = key(r)
    if (k) m.set(k, (m.get(k) ?? 0) + weight(r))
  }
  return [...m].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
}

export default async function ReportsPage() {
  await requireStaff(["management", "approver", "finance"], "/console/reports")
  const db = supabaseAdmin()
  const [{ data: regs }, { data: items }, { data: claims }, { data: rejections }, { data: invoices }, { data: sheets }] = await Promise.all([
    db.from("registrations").select("id, status, care_plus, state, submitted_at"),
    db.from("registration_items").select("product_name, category, qty_used, care_plus"),
    db.from("claims").select("status, complaint_type, decision, submitted_at, closed_at, affected_qty, approved_qty"),
    db.from("audit_events").select("data").eq("entity", "registration").eq("action", "rejected"),
    db.from("registration_invoices").select("dealer_name, registration_id"),
    db.from("compensation_sheets").select("total_payable, finance_approved_at"),
  ])
  const R = regs ?? []
  const I = items ?? []
  const C = claims ?? []

  const coveredSheets = I.filter((i) => i.care_plus).reduce((s, i) => s + i.qty_used, 0)
  const active = R.filter((r) => r.status === "active").length
  const closed = C.filter((c) => c.closed_at)
  const avgClosureDays = closed.length ? closed.reduce((s, c) => s + (Date.parse(c.closed_at!) - Date.parse(c.submitted_at)) / 86_400_000, 0) / closed.length : null
  const paid = (sheets ?? []).filter((s) => s.finance_approved_at)
  const avgComp = paid.length ? paid.reduce((s, x) => s + Number(x.total_payable), 0) / paid.length : null
  const decided = C.filter((c) => c.decision)

  const months: { name: string; value: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i, 1)
    const key = d.toISOString().slice(0, 7)
    months.push({ name: d.toLocaleString("en-IN", { month: "short" }), value: R.filter((r) => r.submitted_at.startsWith(key)).length })
  }

  const kpis = [
    { label: "Registrations", value: R.length.toString() },
    { label: "SylvanCare+ active", value: active.toString() },
    { label: "Covered sheets", value: coveredSheets.toLocaleString("en-IN") },
    { label: "Claims per 1,000 sheets", value: coveredSheets ? ((C.length / coveredSheets) * 1000).toFixed(1) : "—" },
    { label: "Approved vs rejected", value: decided.length ? `${decided.filter((c) => c.decision !== "rejected").length} / ${decided.filter((c) => c.decision === "rejected").length}` : "—" },
    { label: "Avg. compensation", value: avgComp != null ? formatINR(avgComp) : "—" },
    { label: "Avg. closure time", value: avgClosureDays != null ? `${avgClosureDays.toFixed(1)} days` : "—" },
  ]

  const thisMonth = new Date().toISOString().slice(0, 7)

  return (
    <>
      <PageHeader title="Reports" description="Registration and claim intelligence for the monthly management review." />
      <PageBody>
        <div className="grid grid-cols-2 gap-3 px-4 sm:grid-cols-4 sm:px-0 xl:grid-cols-7">
          {kpis.map((k) => (
            <Card key={k.label} size="sm">
              <CardHeader>
                <CardDescription className="line-clamp-2 min-h-10">{k.label}</CardDescription>
                <CardTitle className="text-xl tabular-nums">{k.value}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>

        <Card className={CONSOLE_CARD}>
          <CardHeader>
            <CardTitle>Month-wise data download</CardTitle>
            <CardDescription>Every registration, invoice, product line, e-warranty and status for the month — opens in Excel.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action="/api/exports/registrations" className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Field className="sm:w-56">
                <FieldLabel htmlFor="month">Month</FieldLabel>
                <Input id="month" name="month" type="month" defaultValue={thisMonth} />
              </Field>
              <Button type="submit" className="h-10">
                <IconDownload data-icon="inline-start" />
                Download CSV
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:gap-5 lg:grid-cols-2">
          <Card className={CONSOLE_CARD}>
            <CardHeader>
              <CardTitle>Registrations by month</CardTitle>
            </CardHeader>
            <CardContent>
              <ReportBarChart data={months} label="Registrations" layout="columns" />
            </CardContent>
          </Card>
          <Card className={CONSOLE_CARD}>
            <CardHeader>
              <CardTitle>Sheets registered by product</CardTitle>
            </CardHeader>
            <CardContent>
              <ReportBarChart data={tally(I, (i) => i.product_name, (i) => i.qty_used).slice(0, 12)} label="Sheets" />
            </CardContent>
          </Card>
          <Card className={CONSOLE_CARD}>
            <CardHeader>
              <CardTitle>Registrations by state</CardTitle>
            </CardHeader>
            <CardContent>
              <ReportBarChart data={tally(R, (r) => r.state).slice(0, 12)} label="Registrations" />
            </CardContent>
          </Card>
          <Card className={CONSOLE_CARD}>
            <CardHeader>
              <CardTitle>Registrations by dealer</CardTitle>
            </CardHeader>
            <CardContent>
              <ReportBarChart data={tally(invoices ?? [], (i) => i.dealer_name).slice(0, 10)} label="Invoices" />
            </CardContent>
          </Card>
          <Card className={CONSOLE_CARD}>
            <CardHeader>
              <CardTitle>Claims by defect type</CardTitle>
            </CardHeader>
            <CardContent>
              <ReportBarChart data={tally(C, (c) => c.complaint_type)} label="Claims" />
            </CardContent>
          </Card>
          <Card className={CONSOLE_CARD}>
            <CardHeader>
              <CardTitle>Registration rejection reasons</CardTitle>
            </CardHeader>
            <CardContent>
              <ReportBarChart data={tally(rejections ?? [], (r) => (r.data as { reason_label?: string }).reason_label)} label="Rejections" />
            </CardContent>
          </Card>
        </div>

        <Card className={CONSOLE_CARD}>
          <CardHeader>
            <CardTitle>SylvanCare+ status</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Registrations</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tally(R, (r) => r.status).map((row) => (
                  <TableRow key={row.name}>
                    <TableCell>{REGISTRATION_STATUS[row.name as RegistrationStatus]?.staff ?? row.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.value}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </PageBody>
    </>
  )
}
