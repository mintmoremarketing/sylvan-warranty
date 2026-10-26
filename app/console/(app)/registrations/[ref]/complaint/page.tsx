import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { submitAssistedClaim } from "@/app/console/(app)/registrations/[ref]/complaint/actions"
import { CONSOLE_CARD, PageBody, PageHeader } from "@/components/console/page-header"
import { ComplaintForm } from "@/components/portal/complaint-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requireStaff } from "@/lib/auth"
import { formatDate, todayIST } from "@/lib/domain/dates"
import { formatMobile } from "@/lib/domain/format"
import { fromSlug, toSlug } from "@/lib/domain/numbers"
import { loadRegistration } from "@/lib/queries"

export const metadata: Metadata = { title: "Raise complaint for customer" }

/** Brief: toll-free / customer-care-assisted claim. Same form and Claim ID as the customer's own. */
export default async function AssistedComplaintPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params
  await requireStaff(["customer_care"], `/console/registrations/${ref}/complaint`)
  const reg = await loadRegistration(fromSlug(ref))
  if (!reg) notFound()
  if (reg.claim) redirect(`/console/claims/${toSlug(reg.claim.claim_no)}`)
  if (reg.status !== "active") redirect(`/console/registrations/${ref}`)

  const today = todayIST()
  const items = reg.items
    .filter((i) => i.care_plus && (!i.care_expiry || i.care_expiry >= today))
    .map((i) => ({ id: i.id, product_name: i.product_name, covered: i.qty_used - i.utilised_qty, care_start: i.care_start }))
  if (!items.length) redirect(`/console/registrations/${ref}`)

  return (
    <>
      <PageHeader
        back={{ href: `/console/registrations/${ref}`, label: reg.wrn }}
        title="Raise complaint for customer"
        description="For complaints received on the toll-free number. Only one complaint can be raised per SylvanCare+ warranty."
      />
      <PageBody className="mx-auto w-full max-w-3xl">
        <Card className={CONSOLE_CARD}>
          <CardHeader>
            <CardTitle>Warranty</CardTitle>
            <CardDescription>Filled in from the registration.</CardDescription>
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
        <ComplaintForm wrn={reg.wrn} items={items} today={today} submit={submitAssistedClaim} doneBase="/console/claims/" assisted />
      </PageBody>
    </>
  )
}
