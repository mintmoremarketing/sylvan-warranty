import { Badge } from "@/components/ui/badge"
import {
  CLAIM_STATUS,
  E_WARRANTY_STATUS,
  REGISTRATION_STATUS,
  type ClaimStatus,
  type RegistrationStatus,
} from "@/lib/domain/constants"
import { formatDateTime } from "@/lib/domain/dates"
import { slaState } from "@/lib/domain/sla"
import { cn } from "@/lib/utils"

type Audience = "staff" | "customer"

export function RegistrationBadge({ status, audience, className }: { status: string; audience: Audience; className?: string }) {
  const s = REGISTRATION_STATUS[status as RegistrationStatus]
  if (!s) return <Badge variant="outline">{status}</Badge>
  return (
    <Badge variant={s.tone} className={className}>
      {audience === "staff" ? s.staff : s.customer}
    </Badge>
  )
}

export function ClaimBadge({ status, audience, className }: { status: string; audience: Audience; className?: string }) {
  const s = CLAIM_STATUS[status as ClaimStatus]
  if (!s) return <Badge variant="outline">{status}</Badge>
  return (
    <Badge variant={s.tone} className={className}>
      {audience === "staff" ? s.label : s.customer}
    </Badge>
  )
}

export function EWarrantyBadge({ status, audience }: { status: keyof typeof E_WARRANTY_STATUS; audience: Audience }) {
  const s = E_WARRANTY_STATUS[status]
  return <Badge variant={s.tone}>{audience === "staff" ? s.label : s.customer}</Badge>
}

export function SlaBadge({ due }: { due: string | null }) {
  const state = slaState(due)
  if (!state) return null
  return (
    <Badge variant={state.overdue ? "destructive" : "outline"} title={`SLA: ${formatDateTime(due)}`}>
      {state.label}
    </Badge>
  )
}

export type TimelineEntry = { id: string | number; title: string; detail?: string | null; who?: string | null; at: string }

export function Timeline({ entries, className }: { entries: TimelineEntry[]; className?: string }) {
  if (!entries.length) return <p className="text-sm text-muted-foreground">No activity yet.</p>
  return (
    <ol className={cn("relative flex flex-col gap-5 border-l pl-5", className)}>
      {entries.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full bg-primary ring-4 ring-background" />
          <p className="text-sm font-medium">{e.title}</p>
          {e.detail && <p className="text-sm whitespace-pre-line text-muted-foreground">{e.detail}</p>}
          <p className="text-xs text-muted-foreground">
            {formatDateTime(e.at)}
            {e.who ? ` · ${e.who}` : ""}
          </p>
        </li>
      ))}
    </ol>
  )
}
