import type { Metadata } from "next"
import { revalidatePath } from "next/cache"
import { IconCheck, IconPhone } from "@tabler/icons-react"

import { CONSOLE_CARD, PageBody, PageHeader } from "@/components/console/page-header"
import { QueueControls } from "@/components/console/queue-controls"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item"
import { requireStaff, staffForAction } from "@/lib/auth"
import { formatDateTime } from "@/lib/domain/dates"
import { formatMobile } from "@/lib/domain/format"
import { supabaseAdmin } from "@/lib/supabase/admin"

export const metadata: Metadata = { title: "Call-back requests" }

const TABS = [
  { key: "open", label: "Open" },
  { key: "done", label: "Done" },
]

async function markDone(formData: FormData) {
  "use server"
  const a = await staffForAction(["customer_care"])
  if (!a.ok) return
  await supabaseAdmin().from("callback_requests").update({ status: "done", handled_by: a.staff.id, handled_at: new Date().toISOString() }).eq("id", String(formData.get("id")))
  revalidatePath("/console", "layout")
}

export default async function CallbacksPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireStaff(["customer_care"], "/console/callbacks")
  const { q = "open" } = await searchParams
  const { data } = await supabaseAdmin()
    .from("callback_requests")
    .select("id, name, mobile, email, topic, message, status, created_at, handled_at, staff:handled_by(full_name)")
    .eq("status", q === "done" ? "done" : "open")
    .order("created_at", { ascending: q !== "done" })
    .limit(200)

  return (
    <>
      <PageHeader title="Call-back requests" description="Customers who asked customer care to call them.">
        <QueueControls basePath="/console/callbacks" tabs={TABS} current={q === "done" ? "done" : "open"} search="" placeholder="" />
      </PageHeader>
      <PageBody>
        <Card className={CONSOLE_CARD}>
          <CardContent>
            {!data?.length ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>All caught up</EmptyTitle>
                  <EmptyDescription>No call-back requests here.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ItemGroup className="gap-2">
                {data.map((c) => (
                  <Item key={c.id} variant="outline" className="items-start">
                    <ItemContent>
                      <ItemTitle>
                        {c.name} <Badge variant="secondary">{c.topic}</Badge>
                      </ItemTitle>
                      <ItemDescription className="line-clamp-none">
                        {formatMobile(c.mobile)}
                        {c.email && ` · ${c.email}`} · {formatDateTime(c.created_at)}
                        {c.message && (
                          <>
                            <br />“{c.message}”
                          </>
                        )}
                        {c.handled_at && (
                          <>
                            <br />
                            Done by {(c.staff as unknown as { full_name: string } | null)?.full_name} on {formatDateTime(c.handled_at)}
                          </>
                        )}
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <Button variant="outline" size="icon" render={<a href={`tel:+91${c.mobile}`} aria-label={`Call ${c.name}`} />} nativeButton={false}>
                        <IconPhone />
                      </Button>
                      {c.status === "open" && (
                        <form action={markDone}>
                          <input type="hidden" name="id" value={c.id} />
                          <Button type="submit" size="icon" aria-label="Mark as done">
                            <IconCheck />
                          </Button>
                        </form>
                      )}
                    </ItemActions>
                  </Item>
                ))}
              </ItemGroup>
            )}
          </CardContent>
        </Card>
      </PageBody>
    </>
  )
}
