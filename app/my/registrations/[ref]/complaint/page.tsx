import type { Metadata } from "next"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { IconChevronLeft } from "@tabler/icons-react"

import { submitClaim } from "@/app/my/registrations/[ref]/complaint/actions"
import { ComplaintForm } from "@/components/portal/complaint-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requireCustomer } from "@/lib/auth"
import { formatDate, todayIST } from "@/lib/domain/dates"
import { formatMobile } from "@/lib/domain/format"
import { fromSlug, toSlug } from "@/lib/domain/numbers"
import { loadRegistration } from "@/lib/queries"

export const metadata: Metadata = { title: "Raise a complaint" }

export default async function ComplaintPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params
  const customer = await requireCustomer(`/my/registrations/${ref}/complaint`)
  const reg = await loadRegistration(fromSlug(ref))
  if (!reg || reg.customer_id !== customer.id) notFound()
  if (reg.claim) redirect(`/my/claims/${toSlug(reg.claim.claim_no)}`)
  if (reg.status !== "active") redirect(`/my/registrations/${ref}`)

  const today = todayIST()
  const items = reg.items
    .filter((i) => i.care_plus && i.review_status !== "rejected" && (!i.care_expiry || i.care_expiry >= today))
    .map((i) => ({ id: i.id, product_name: i.product_name, covered: i.qty_used - i.utilised_qty, care_start: i.care_start }))
  if (!items.length) redirect(`/my/registrations/${ref}`)

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-3 py-6 xs:px-4 sm:gap-6 sm:py-10">
      <div className="flex flex-col gap-2 px-4 xs:px-0">
        <Button variant="link" className="h-auto w-fit p-0" render={<Link href={`/my/registrations/${ref}`} />} nativeButton={false}>
          <IconChevronLeft data-icon="inline-start" />
          {reg.wrn}
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Raise a complaint</h1>
        <p className="text-sm text-muted-foreground">You can raise one complaint per SylvanCare+ warranty, so please include everything that&apos;s affected.</p>
      </div>
      <Card className="max-xs:rounded-none max-xs:border-y max-xs:ring-0">
        <CardHeader>
          <CardTitle>Your warranty</CardTitle>
          <CardDescription>We&apos;ve filled this in from your registration.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Registration</dt>
            <dd className="font-mono">{reg.wrn}</dd>
            <dt className="text-muted-foreground">Owner</dt>
            <dd>
              {reg.owner_name} · {formatMobile(reg.owner_mobile)}
            </dd>
            <dt className="text-muted-foreground">Site</dt>
            <dd>
              {reg.site_address}, {reg.city} {reg.pincode}
            </dd>
            <dt className="text-muted-foreground">Invoice</dt>
            <dd>{reg.invoices.map((i) => `${i.invoice_number} (${formatDate(i.invoice_date)})`).join(", ")}</dd>
          </dl>
        </CardContent>
      </Card>
      <ComplaintForm wrn={reg.wrn} items={items} today={today} submit={submitClaim} />
    </main>
  )
}
