import type { Metadata } from "next"

import { CONSOLE_CARD, PageBody, PageHeader } from "@/components/console/page-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item"
import { requireStaff } from "@/lib/auth"
import { formatDateTime } from "@/lib/domain/dates"
import { supabaseAdmin } from "@/lib/supabase/admin"

export const metadata: Metadata = { title: "Messages sent" }

export default async function MessagesPage() {
  await requireStaff(["customer_care"], "/console/messages")
  const { data } = await supabaseAdmin()
    .from("message_log")
    .select("id, channel, template, recipient, subject, body, status, error, created_at")
    .order("created_at", { ascending: false })
    .limit(200)

  return (
    <>
      <PageHeader
        title="Messages sent"
        description="Every customer communication, from the brief's template list. Email today; SMS and WhatsApp will appear here once DLT and WhatsApp approval are done."
      />
      <PageBody>
        <Card className={CONSOLE_CARD}>
          <CardHeader>
            <CardTitle>Latest 200</CardTitle>
            <CardDescription>Assisted-registration consent codes are masked.</CardDescription>
          </CardHeader>
          <CardContent>
            <ItemGroup className="gap-2">
              {(data ?? []).map((m) => (
                <Item key={m.id} variant="outline" size="sm" className="items-start">
                  <ItemContent>
                    <ItemTitle className="flex-wrap">
                      {m.subject}
                      <Badge variant="outline">{m.channel}</Badge>
                      <Badge variant={m.status === "failed" ? "destructive" : m.status === "sent" ? "secondary" : "outline"}>{m.status}</Badge>
                    </ItemTitle>
                    <ItemDescription className="line-clamp-2">
                      To {m.recipient} · {formatDateTime(m.created_at)} · {m.template.replaceAll("_", " ")}
                      {m.error && ` · ${m.error}`}
                    </ItemDescription>
                  </ItemContent>
                </Item>
              ))}
            </ItemGroup>
          </CardContent>
        </Card>
      </PageBody>
    </>
  )
}
