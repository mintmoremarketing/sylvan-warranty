import type { Metadata } from "next"
import Link from "next/link"
import {
  IconAlertCircle,
  IconArrowRight,
  IconCertificate,
  IconFilePlus,
  IconInfoCircle,
  IconMessageReport,
  IconShieldCheck,
} from "@tabler/icons-react"

import { ClaimBadge, EWarrantyBadge, RegistrationBadge } from "@/components/status"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Separator } from "@/components/ui/separator"
import { requireCustomer } from "@/lib/auth"
import { categoryLabel } from "@/lib/domain/constants"
import { formatDate, todayIST } from "@/lib/domain/dates"
import { toSlug } from "@/lib/domain/numbers"
import { supabaseAdmin } from "@/lib/supabase/admin"

export const metadata: Metadata = { title: "My warranties" }

type Row = {
  id: string
  wrn: string
  status: string
  care_plus: boolean
  submitted_at: string
  site_address: string
  city: string
  claim_locked_at: string | null
  registration_items: { product_name: string; category: string; qty_used: number; care_plus: boolean; care_expiry: string | null }[]
  e_warranties: { id: string; program: string; number: string | null; status: "pending_review" | "issued" | "rejected"; warranty_programs: { name: string } | null }[]
  claims: { claim_no: string; status: string }[] | { claim_no: string; status: string } | null
}

export default async function MyDashboard({ searchParams }: { searchParams: Promise<{ intent?: string }> }) {
  const customer = await requireCustomer("/my")
  const { intent } = await searchParams
  const { data } = await supabaseAdmin()
    .from("registrations")
    .select(
      "id, wrn, status, care_plus, submitted_at, site_address, city, claim_locked_at, registration_items(product_name, category, qty_used, care_plus, care_expiry), e_warranties(id, program, number, status, warranty_programs(name)), claims(claim_no, status)"
    )
    .eq("customer_id", customer.id)
    .order("submitted_at", { ascending: false })
  const rows = (data ?? []) as unknown as Row[]
  const today = todayIST()
  const name = customer.full_name?.split(" ")[0] ?? "there"

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 py-6 xs:px-4 sm:py-10">
      <div className="flex flex-col gap-4 px-4 xs:px-0 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Hi {name}, thank you for choosing Sylvan Ply</h1>
          <p className="text-muted-foreground">Your warranties and complaints, all in one place.</p>
        </div>
        <Button size="lg" className="max-sm:h-11" render={<Link href="/my/register" />} nativeButton={false}>
          <IconFilePlus data-icon="inline-start" />
          Register another warranty
        </Button>
      </div>

      {intent === "complaint" && (
        <Alert className="max-xs:mx-4 max-xs:w-auto">
          <IconInfoCircle />
          <AlertTitle>Raising a complaint</AlertTitle>
          <AlertDescription>
            Complaints can be raised on an active SylvanCare+ warranty. Open the warranty below and choose “Raise a complaint”.
          </AlertDescription>
        </Alert>
      )}

      {rows.length === 0 ? (
        <Card className="max-xs:rounded-none max-xs:border-y max-xs:ring-0">
          <CardContent>
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <IconShieldCheck />
                </EmptyMedia>
                <EmptyTitle>No warranties yet</EmptyTitle>
                <EmptyDescription>Register your Sylvan purchase to get SylvanCare+ and your standard e-warranty.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button render={<Link href="/my/register" />} nativeButton={false}>
                  Register warranty
                </Button>
              </EmptyContent>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        rows.map((r) => {
          const claim = Array.isArray(r.claims) ? r.claims[0] : r.claims
          const careItems = r.registration_items.filter((i) => i.care_plus)
          const expiry = careItems.map((i) => i.care_expiry).filter(Boolean).sort().pop() ?? null
          const expired = r.status === "active" && expiry !== null && expiry < today
          const slug = toSlug(r.wrn)
          return (
            <Card key={r.id} className="max-xs:rounded-none max-xs:border-y max-xs:ring-0">
              <CardHeader>
                <CardDescription className="font-mono">{r.wrn}</CardDescription>
                <CardTitle className="text-lg">
                  {r.registration_items.map((i) => i.product_name).filter((v, i, a) => a.indexOf(v) === i).join(", ")}
                </CardTitle>
                <CardDescription>
                  {r.site_address}, {r.city} · registered {formatDate(r.submitted_at)}
                </CardDescription>
                <CardAction>
                  {r.care_plus && (expired ? <Badge variant="outline">Expired</Badge> : <RegistrationBadge status={r.status} audience="customer" />)}
                </CardAction>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {r.status === "info_required" && (
                  <Alert variant="destructive">
                    <IconAlertCircle />
                    <AlertTitle>Action required</AlertTitle>
                    <AlertDescription>We need a little more information to verify this registration.</AlertDescription>
                  </Alert>
                )}

                <div className="flex flex-col gap-2">
                  {r.care_plus ? (
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <IconShieldCheck className="size-4 text-primary" />
                      <span className="font-medium">SylvanCare+</span>
                      <span className="text-muted-foreground">
                        {careItems.map((i) => `${i.product_name} · ${i.qty_used} sheets`).join(", ")}
                        {r.status === "active" && expiry ? ` · valid till ${formatDate(expiry)}` : ""}
                      </span>
                      {r.claim_locked_at && <Badge variant="outline">Claim registered: inactive for further claims</Badge>}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No products in this registration qualify for SylvanCare+.</p>
                  )}
                  {r.e_warranties.map((e) => (
                    <div key={e.id} className="flex flex-wrap items-center gap-2 text-sm">
                      <IconCertificate className="size-4 text-muted-foreground" />
                      <span className="font-medium">Standard e-warranty</span>
                      <span className="text-muted-foreground">{e.warranty_programs?.name}</span>
                      <EWarrantyBadge status={e.status} audience="customer" />
                    </div>
                  ))}
                  {claim && (
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <IconMessageReport className="size-4 text-muted-foreground" />
                      <span className="font-medium">Complaint {claim.claim_no}</span>
                      <ClaimBadge status={claim.status} audience="customer" />
                    </div>
                  )}
                </div>

                {r.status === "rejected" && (
                  <p className="text-sm text-muted-foreground">
                    The standard Sylvan product warranty remains applicable as per its terms.
                  </p>
                )}
                <Separator />
                <p className="text-xs text-muted-foreground">
                  {r.registration_items.map((i) => `${i.product_name} ${categoryLabel(i.category).toLowerCase()}`).join(" · ")}
                </p>
              </CardContent>
              <CardFooter className="flex-wrap gap-2">
                <Button variant="outline" render={<Link href={`/my/registrations/${slug}`} />} nativeButton={false}>
                  {r.status === "info_required" ? "Upload information" : "View details"}
                  <IconArrowRight data-icon="inline-end" />
                </Button>
                {r.status === "active" && !expired && !r.claim_locked_at && (
                  <Button variant="ghost" render={<Link href={`/my/registrations/${slug}/complaint`} />} nativeButton={false}>
                    <IconMessageReport data-icon="inline-start" />
                    Raise a complaint
                  </Button>
                )}
                {claim && (
                  <Button variant="ghost" render={<Link href={`/my/claims/${toSlug(claim.claim_no)}`} />} nativeButton={false}>
                    Track complaint
                  </Button>
                )}
              </CardFooter>
            </Card>
          )
        })
      )}
    </main>
  )
}
