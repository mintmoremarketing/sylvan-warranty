"use client"

import { useState } from "react"
import { IconFlag } from "@tabler/icons-react"

import { clearFlag } from "@/app/console/(app)/registrations/actions"
import { ActionDrawer } from "@/components/console/action-drawer"
import { FormField } from "@/components/form-field"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item"
import { Textarea } from "@/components/ui/textarea"

type Flag = { id: string; code: string; severity: string; detail: string; status: string; cleared_reason: string | null }

const LABELS: Record<string, string> = {
  duplicate_invoice: "Duplicate invoice number",
  duplicate_invoice_file: "Same invoice file reused",
  repeat_mobile: "Repeat mobile number",
  site_reused: "Site registered by someone else",
  unlisted_dealer: "Dealer not on authorised list",
}

export function FlagList({ flags, canClear }: { flags: Flag[]; canClear: boolean }) {
  return (
    <ItemGroup className="gap-2">
      {flags.map((f) => (
        <Item key={f.id} variant={f.status === "open" ? "outline" : "muted"} size="sm">
          <ItemMedia variant="icon">
            <IconFlag className={f.severity === "high" && f.status === "open" ? "text-destructive" : undefined} />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>
              {LABELS[f.code] ?? f.code}
              <Badge variant={f.status !== "open" ? "outline" : f.severity === "high" ? "destructive" : "secondary"}>{f.status === "open" ? f.severity : "cleared"}</Badge>
            </ItemTitle>
            <ItemDescription className="line-clamp-none">
              {f.detail}
              {f.cleared_reason ? ` — cleared: ${f.cleared_reason}` : ""}
            </ItemDescription>
          </ItemContent>
          {canClear && f.status === "open" && (
            <ItemActions>
              <ClearFlag id={f.id} />
            </ItemActions>
          )}
        </Item>
      ))}
    </ItemGroup>
  )
}

function ClearFlag({ id }: { id: string }) {
  const [reason, setReason] = useState("")
  return (
    <ActionDrawer
      trigger={<Button variant="ghost" size="sm" />}
      label="Clear"
      title="Clear this flag"
      description="Clearing a flag is logged as an override with your name and reason."
      submitLabel="Clear flag"
      success="Flag cleared"
      run={() => clearFlag(id, reason)}
    >
      <FormField label="Why is this OK?" htmlFor={`clear-${id}`} required>
        <Textarea id={`clear-${id}`} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </FormField>
    </ActionDrawer>
  )
}
