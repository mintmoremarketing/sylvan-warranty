import type { Metadata } from "next"
import Link from "next/link"
import {
  IconAlertCircle,
  IconArrowRight,
  IconCertificate,
  IconDownload,
  IconFilePlus,
  IconHelpCircle,
  IconInfoCircle,
  IconMessageReport,
  IconShieldCheck,
} from "@tabler/icons-react"

import { CallbackDialog } from "@/components/site/callback-dialog"
import { ClaimBadge, EWarrantyBadge, RegistrationBadge } from "@/components/status"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { requireCustomer } from "@/lib/auth"
import { categoryLabel } from "@/lib/domain/constants"
import { formatDate, todayIST } from "@/lib/domain/dates"
import { toSlug } from "@/lib/domain/numbers"
import { supabaseAdmin } from "@/lib/supabase/admin"

export const metadata: Metadata = { title: "My warranties" }

type ItemRow = {
  id: string
  product_name: string
  category: string
  qty_used: number
  care_plus: boolean
  standard: boolean
  care_start: string | null
  care_expiry: string | null
  review_status: "pending" | "approved" | "rejected"
}

type EwRow = {
  id: string
  number: string | null
  status: "pending_review" | "issued" | "rejected"
  issued_at: string | null
  e_warranty_items: { item_id: string | null; warranty_period: string }[]
}

type Row = {
  id: string
  wrn: string
  status: string
  care_plus: boolean
  submitted_at: string
  site_address: string
  city: string
  claim_locked_at: string | null
  registration_items: ItemRow[]
  e_warranties: EwRow[]
  claims: { claim_no: string; status: string }[] | { claim_no: string; status: string } | null
}

const CARD = "max-xs:rounded-none max-xs:border-y max-xs:ring-0"

export default async function MyDashboard({ searchParams }: { searchParams: Promise<{ intent?: string }> }) {
  const customer = await requireCustomer("/my")
  const { intent } = await searchParams
  const { data } = await supabaseAdmin()
    .from("registrations")
    .select(
      "id, wrn, status, care_plus, submitted_at, site_address, city, claim_locked_at, registration_items(id, product_name, category, qty_used, care_plus, standard, care_start, care_expiry, review_status), e_warranties(id, number, status, issued_at, e_warranty_items(item_id, warranty_period)), claims(claim_no, status)"
    )
    .eq("customer_id", customer.id)
    .order("submitted_at", { ascending: false })
  const rows = (data ?? []) as unknown as Row[]
  const today = todayIST()
  const name = customer.full_name?.split(" ")[0] ?? "there"

  // Every product the customer registered, with the certificate it is on and what they can do with it.
  const products = rows.flatMap((r) => {
    const claim = Array.isArray(r.claims) ? r.claims[0] : r.claims
    return r.registration_items
      .filter((i) => i.care_plus || i.standard)
      .map((i) => {
        const ew = r.e_warranties.find((e) => e.e_warranty_items.some((l) => l.item_id === i.id)) ?? null
        const ewLine = ew?.e_warranty_items.find((l) => l.item_id === i.id) ?? null
        const expired = !!i.care_expiry && i.care_expiry < today
        return { reg: r, item: i, claim, ew, ewLine, expired }
      })
  })
  type Product = (typeof products)[number]
  const careActive = (p: Product) => p.item.care_plus && p.reg.status === "active" && p.item.review_status !== "rejected" && !p.expired
  const certificateReady = (p: Product) => (p.item.care_plus ? careActive(p) : p.ew?.status === "issued" && p.item.review_status !== "rejected")

  const stats = [
    { label: "Products registered", value: products.length },
    { label: "SylvanCare+ active", value: products.filter(careActive).length },
    { label: "Certificates ready", value: products.filter(certificateReady).length },
    { label: "Open complaints", value: rows.filter((r) => { const c = Array.isArray(r.claims) ? r.claims[0] : r.claims; return c && c.status !== "closed" }).length },
  ]
  const needInfo = rows.filter((r) => r.status === "info_required")

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 py-6 xs:px-4 sm:py-10">
      <div className="flex flex-col gap-4 px-4 xs:px-0 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Hi {name}, thank you for choosing Sylvan Ply</h1>
          <p className="text-muted-foreground">Your products, warranties and complaints, all in one place.</p>
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
          <AlertDescription>Complaints can be raised on a product with an active SylvanCare+ warranty. Choose “Raise a complaint” on that product below.</AlertDescription>
        </Alert>
      )}

      {needInfo.map((r) => (
        <Alert key={r.id} variant="destructive" className="max-xs:mx-4 max-xs:w-auto">
          <IconAlertCircle />
          <AlertTitle>Action required on {r.wrn}</AlertTitle>
          <AlertDescription>
            We need a little more information to verify this registration.{" "}
            <Link href={`/my/registrations/${toSlug(r.wrn)}`} className="font-medium underline underline-offset-4">
              Upload information
            </Link>
          </AlertDescription>
        </Alert>
      ))}

      {rows.length === 0 ? (
        <Card className={CARD}>
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
        <>
          <div className="grid grid-cols-2 gap-3 px-4 xs:px-0 sm:grid-cols-4">
            {stats.map((s) => (
              <Card key={s.label} size="sm">
                <CardHeader>
                  <CardDescription>{s.label}</CardDescription>
                  <CardTitle className="text-2xl tabular-nums">{s.value}</CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>

          <section className="flex flex-col gap-3">
            <h2 className="px-4 text-lg font-semibold xs:px-0">My products</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {products.map((p) => (
                <ProductCard key={p.item.id} p={p} customer={customer} />
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="px-4 text-lg font-semibold xs:px-0">My registrations</h2>
            {rows.map((r) => {
              const claim = Array.isArray(r.claims) ? r.claims[0] : r.claims
              const ew = r.e_warranties.find((e) => e.status !== "rejected") ?? r.e_warranties[0]
              return (
                <Card key={r.id} size="sm" className={CARD}>
                  <CardHeader>
                    <CardTitle className="font-mono">{r.wrn}</CardTitle>
                    <CardDescription>
                      {r.site_address}, {r.city} · registered {formatDate(r.submitted_at)} · {r.registration_items.length} product
                      {r.registration_items.length === 1 ? "" : "s"}
                    </CardDescription>
                    <CardAction>
                      <Button variant="outline" size="sm" render={<Link href={`/my/registrations/${toSlug(r.wrn)}`} />} nativeButton={false}>
                        Details
                        <IconArrowRight data-icon="inline-end" />
                      </Button>
                    </CardAction>
                  </CardHeader>
                  <CardContent className="flex flex-wrap items-center gap-2 text-sm">
                    {r.care_plus && (
                      <span className="flex items-center gap-1.5">
                        <IconShieldCheck className="size-4 text-primary" />
                        SylvanCare+ <RegistrationBadge status={r.status} audience="customer" />
                      </span>
                    )}
                    {ew && (
                      <span className="flex items-center gap-1.5">
                        <IconCertificate className="size-4 text-muted-foreground" />
                        Standard <EWarrantyBadge status={ew.status} audience="customer" />
                      </span>
                    )}
                    {claim && (
                      <Link href={`/my/claims/${toSlug(claim.claim_no)}`} className="flex items-center gap-1.5 hover:underline">
                        <IconMessageReport className="size-4 text-muted-foreground" />
                        Complaint {claim.claim_no} <ClaimBadge status={claim.status} audience="customer" />
                      </Link>
                    )}
                    {r.status === "rejected" && <span className="text-muted-foreground">The standard Sylvan product warranty remains applicable as per its terms.</span>}
                  </CardContent>
                </Card>
              )
            })}
          </section>
        </>
      )}
    </main>
  )
}

type Customer = Awaited<ReturnType<typeof requireCustomer>>

function ProductCard({
  p,
  customer,
}: {
  p: { reg: Row; item: ItemRow; claim: { claim_no: string; status: string } | null | undefined; ew: EwRow | null; ewLine: { warranty_period: string } | null; expired: boolean }
  customer: Customer
}) {
  const { reg, item, claim, ew, ewLine, expired } = p
  const slug = toSlug(reg.wrn)
  const rejected = item.review_status === "rejected"
  const careActive = item.care_plus && reg.status === "active" && !rejected && !expired

  let status: React.ReactNode
  let coverage: string
  let certificate: string | null = null
  if (item.care_plus) {
    if (rejected) {
      status = <Badge variant="outline">Not covered</Badge>
      coverage = "Not covered by SylvanCare+ after verification."
    } else if (reg.status === "active") {
      status = expired ? <Badge variant="outline">Expired</Badge> : <RegistrationBadge status="active" audience="customer" />
      coverage = item.care_start ? `Covered ${formatDate(item.care_start)} – ${formatDate(item.care_expiry)}` : "Covered"
      if (!expired) certificate = `/api/certificates/care-plus/${slug}`
    } else {
      status = <RegistrationBadge status={reg.status} audience="customer" />
      coverage = reg.status === "rejected" ? "The standard Sylvan product warranty remains applicable." : "Coverage dates appear once your registration is approved."
    }
  } else if (rejected || ew?.status === "rejected") {
    status = <Badge variant="outline">Not issued</Badge>
    coverage = "No standard e-warranty was issued for this product."
  } else if (ew?.status === "issued") {
    status = <EWarrantyBadge status="issued" audience="customer" />
    coverage = `${ewLine?.warranty_period ?? "Standard"} warranty${ew.number ? ` · ${ew.number}` : ""}`
    certificate = `/api/certificates/e-warranty/${ew.id}`
  } else {
    status = <EWarrantyBadge status="pending_review" audience="customer" />
    coverage = "Your e-warranty is being reviewed and will be emailed to you."
  }

  return (
    <Card size="sm" className={CARD}>
      <CardHeader>
        <CardDescription className="flex items-center gap-1.5">
          {item.care_plus ? <IconShieldCheck className="size-4 text-primary" /> : <IconCertificate className="size-4" />}
          {item.care_plus ? "SylvanCare+" : "Standard e-warranty"}
        </CardDescription>
        <CardTitle>{item.product_name}</CardTitle>
        <CardDescription>
          {categoryLabel(item.category)} · {item.qty_used} used at site · <span className="font-mono">{reg.wrn}</span>
        </CardDescription>
        <CardAction>{status}</CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-1 text-sm">
        <p>{coverage}</p>
        {item.care_plus && reg.claim_locked_at && <p className="text-muted-foreground">Claim registered: inactive for further claims.</p>}
      </CardContent>
      <CardFooter className="flex-wrap gap-2">
        {certificate && (
          <Button variant="outline" size="sm" render={<a href={certificate} target="_blank" rel="noreferrer" />} nativeButton={false}>
            <IconDownload data-icon="inline-start" />
            Certificate
          </Button>
        )}
        {careActive && !reg.claim_locked_at && (
          <Button variant="outline" size="sm" render={<Link href={`/my/registrations/${slug}/complaint`} />} nativeButton={false}>
            <IconMessageReport data-icon="inline-start" />
            Raise a complaint
          </Button>
        )}
        {item.care_plus && claim && (
          <Button variant="ghost" size="sm" render={<Link href={`/my/claims/${toSlug(claim.claim_no)}`} />} nativeButton={false}>
            Track complaint
          </Button>
        )}
        <CallbackDialog
          defaultTopic={careActive || certificate ? "Something else" : "Warranty status"}
          defaults={{
            name: customer.full_name ?? "",
            mobile: customer.mobile ?? "",
            email: customer.email,
            message: `Help with ${item.product_name} (${reg.wrn}).`,
          }}
          render={<Button variant="ghost" size="sm" />}
        >
          <IconHelpCircle data-icon="inline-start" />
          Get help
        </CallbackDialog>
      </CardFooter>
    </Card>
  )
}
