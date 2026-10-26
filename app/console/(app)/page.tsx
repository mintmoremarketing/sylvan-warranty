import type { Metadata } from "next"
import Link from "next/link"
import {
  IconAlertTriangle,
  IconArrowRight,
  IconFilePlus,
  IconLock,
} from "@tabler/icons-react"

import {
  CONSOLE_CARD,
  PageBody,
  PageHeader,
} from "@/components/console/page-header"
import { ClaimBadge, RegistrationBadge, SlaBadge } from "@/components/status"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import { hasRole, requireStaff } from "@/lib/auth"
import { formatDateTime } from "@/lib/domain/dates"
import { toSlug } from "@/lib/domain/numbers"
import { supabaseAdmin } from "@/lib/supabase/admin"

export const metadata: Metadata = { title: "Console" }

export default async function ConsoleHome({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>
}) {
  const staff = await requireStaff()
  const { denied } = await searchParams
  const db = supabaseAdmin()
  const now = new Date().toISOString()
  const head = { count: "exact" as const, head: true }

  const [
    received,
    verifying,
    approval,
    active,
    openClaims,
    overdueRegs,
    overdueClaims,
    myInspections,
    myEw,
  ] = await Promise.all([
    db.from("registrations").select("id", head).eq("status", "received"),
    db
      .from("registrations")
      .select("id", head)
      .in("status", [
        "under_verification",
        "info_required",
        "inspection_required",
        "inspector_assigned",
      ]),
    db
      .from("registrations")
      .select("id", head)
      .in("status", ["inspection_completed", "pending_approval"]),
    db.from("registrations").select("id", head).eq("status", "active"),
    db
      .from("claims")
      .select("id", head)
      .not("status", "in", "(closed,rejected)"),
    db
      .from("registrations")
      .select("wrn, owner_name, status, sla_due_at")
      .lt("sla_due_at", now)
      .not("status", "in", "(active,rejected,not_applicable)")
      .order("sla_due_at")
      .limit(8),
    db
      .from("claims")
      .select("claim_no, status, sla_due_at")
      .lt("sla_due_at", now)
      .not("status", "in", "(closed,rejected,settlement_completed)")
      .order("sla_due_at")
      .limit(8),
    db
      .from("inspections")
      .select(
        "id, kind, scheduled_at, status, registrations(wrn, owner_name, city)"
      )
      .eq("inspector_id", staff.id)
      .in("status", ["assigned", "scheduled", "revisit_required"])
      .order("scheduled_at", { nullsFirst: false })
      .limit(8),
    db
      .from("e_warranties")
      .select("id", head)
      .eq("status", "pending_review")
      .eq("coordinator_id", staff.id),
  ])

  // Company-wide numbers only for roles that can open those queues (dealers and inspectors see their own work).
  const seesRegs = hasRole(staff, [
    "verifier",
    "approver",
    "customer_care",
    "management",
  ])
  const seesClaims = hasRole(staff, [
    "verifier",
    "technical",
    "approver",
    "finance",
    "customer_care",
    "management",
  ])
  const assists = hasRole(staff, ["customer_care"])

  const kpis = [
    ...(seesRegs
      ? [
          {
            label: "New registrations",
            value: received.count ?? 0,
            href: "/console/registrations?q=new",
          },
          {
            label: "In verification",
            value: verifying.count ?? 0,
            href: "/console/registrations?q=verification",
          },
          {
            label: "Awaiting approval",
            value: approval.count ?? 0,
            href: "/console/registrations?q=approval",
          },
          {
            label: "Active warranties",
            value: active.count ?? 0,
            href: "/console/registrations?q=active",
          },
        ]
      : []),
    ...(seesClaims
      ? [
          {
            label: "Open claims",
            value: openClaims.count ?? 0,
            href: "/console/claims",
          },
        ]
      : []),
  ]
  const overdue = [
    ...(seesRegs ? (overdueRegs.data ?? []) : []).map((r) => ({
      key: r.wrn,
      title: r.wrn,
      sub: r.owner_name,
      href: `/console/registrations/${toSlug(r.wrn)}`,
      badge: <RegistrationBadge status={r.status} audience="staff" />,
      due: r.sla_due_at,
    })),
    ...(seesClaims ? (overdueClaims.data ?? []) : []).map((c) => ({
      key: c.claim_no,
      title: c.claim_no,
      sub: "Claim",
      href: `/console/claims/${toSlug(c.claim_no)}`,
      badge: <ClaimBadge status={c.status} audience="staff" />,
      due: c.sla_due_at,
    })),
  ]

  return (
    <>
      <PageHeader
        title={`Good to see you, ${staff.full_name}`}
        description="Here's what needs your attention today."
      />
      <PageBody>
        {denied && (
          <Alert variant="destructive" className="max-sm:mx-4 max-sm:w-auto">
            <IconLock />
            <AlertTitle>You don&apos;t have access to that page</AlertTitle>
            <AlertDescription>
              Ask an admin to add the role you need.
            </AlertDescription>
          </Alert>
        )}

        {kpis.length > 0 && (
          <div className="grid grid-cols-2 gap-3 px-4 sm:grid-cols-3 sm:px-0 lg:grid-cols-5">
            {kpis.map((k) => (
              <Link
                key={k.label}
                href={k.href}
                className="rounded-xl ring-1 ring-foreground/10 transition-colors hover:bg-muted/60"
              >
                <Card className="h-full bg-transparent ring-0">
                  <CardHeader>
                    <CardDescription>{k.label}</CardDescription>
                    <CardTitle className="text-3xl tabular-nums">
                      {k.value}
                    </CardTitle>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        )}

        <div className="grid gap-3 sm:gap-5 lg:grid-cols-2">
          {(seesRegs || seesClaims) && (
            <Card className={CONSOLE_CARD}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconAlertTriangle className="size-4 text-destructive" />
                  SLA overdue
                </CardTitle>
                <CardDescription>
                  48 working hours from submission or inspection, per the brief.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {overdue.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nothing overdue. Nice.
                  </p>
                ) : (
                  <ItemGroup className="gap-2">
                    {overdue.map((o) => (
                      <Item
                        key={o.key}
                        variant="outline"
                        size="sm"
                        render={<Link href={o.href} />}
                      >
                        <ItemContent>
                          <ItemTitle className="font-mono">{o.title}</ItemTitle>
                          <ItemDescription>{o.sub}</ItemDescription>
                        </ItemContent>
                        <ItemActions className="flex-col items-end gap-1">
                          {o.badge}
                          <SlaBadge due={o.due} />
                        </ItemActions>
                      </Item>
                    ))}
                  </ItemGroup>
                )}
              </CardContent>
            </Card>
          )}

          {hasRole(staff, ["inspector"]) && (
            <Card className={CONSOLE_CARD}>
              <CardHeader>
                <CardTitle>My inspections</CardTitle>
                <CardAction>
                  <Button
                    variant="ghost"
                    size="sm"
                    render={<Link href="/console/inspections" />}
                    nativeButton={false}
                  >
                    All
                    <IconArrowRight data-icon="inline-end" />
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent>
                {(myInspections.data ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No inspections assigned to you.
                  </p>
                ) : (
                  <ItemGroup className="gap-2">
                    {(myInspections.data ?? []).map((i) => {
                      const reg = i.registrations as unknown as {
                        wrn: string
                        owner_name: string
                        city: string
                      }
                      return (
                        <Item
                          key={i.id}
                          variant="outline"
                          size="sm"
                          render={
                            <Link href={`/console/inspections/${i.id}`} />
                          }
                        >
                          <ItemContent>
                            <ItemTitle>
                              {reg.owner_name} · {reg.city}
                            </ItemTitle>
                            <ItemDescription>
                              {i.kind === "claim"
                                ? "Claim inspection"
                                : "Registration verification"}{" "}
                              ·{" "}
                              {i.scheduled_at
                                ? formatDateTime(i.scheduled_at)
                                : "Not scheduled yet"}
                            </ItemDescription>
                          </ItemContent>
                        </Item>
                      )
                    })}
                  </ItemGroup>
                )}
              </CardContent>
            </Card>
          )}

          {hasRole(staff, ["sales_coordinator"]) && (
            <Card className={CONSOLE_CARD}>
              <CardHeader>
                <CardTitle>E-warranties to issue</CardTitle>
                <CardDescription>
                  {myEw.count ?? 0} waiting for your review.
                </CardDescription>
                <CardAction>
                  <Button
                    variant="outline"
                    size="sm"
                    render={<Link href="/console/e-warranties" />}
                    nativeButton={false}
                  >
                    Review
                  </Button>
                </CardAction>
              </CardHeader>
            </Card>
          )}

          {assists && (
            <Card className={CONSOLE_CARD}>
              <CardHeader>
                <CardTitle>Register for a customer</CardTitle>
                <CardDescription>
                  Fill in the registration on the customer&apos;s behalf. They
                  confirm with a code sent to their email.
                </CardDescription>
                <CardAction>
                  <Button
                    size="sm"
                    render={<Link href="/console/assisted" />}
                    nativeButton={false}
                  >
                    <IconFilePlus data-icon="inline-start" />
                    Start
                  </Button>
                </CardAction>
              </CardHeader>
            </Card>
          )}
        </div>
      </PageBody>
    </>
  )
}
