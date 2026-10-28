"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { IconArrowBackUp, IconCertificate, IconChevronRight, IconListCheck, IconShieldCheck } from "@tabler/icons-react"

import { reviewItem } from "@/app/console/(app)/registrations/actions"
import { ActionDrawer } from "@/components/console/action-drawer"
import { FormField } from "@/components/form-field"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { categoryLabel, checksFor, ITEM_REVIEW, type ItemReview, type VerificationKey, type VerificationResult } from "@/lib/domain/constants"

export type ReviewLine = {
  id: string
  product_name: string
  category: string
  qty_purchased: number
  qty_used: number
  invoice_number: string
  review_status: ItemReview
  review_note: string | null
  /** The saved checklist answers for this product. */
  checks: Record<string, VerificationResult> | null
  /** What the system can already tell, used to pre-fill a new checklist. */
  suggested: Partial<Record<VerificationKey, VerificationResult>>
  care_plus: boolean
  reviewed: string | null
  /** Whether the current staff member can approve / reject this line now. */
  editable: boolean
}

export type ReviewGroup = { key: "care_plus" | "standard"; title: string; description: string; lines: ReviewLine[] }

/**
 * Every product in a registration is checked on its own, grouped by the certificate it goes on: the SylvanCare+
 * certificate and the standard e-warranty. Only approved products are printed on each.
 */
export function ProductReview({ groups }: { groups: ReviewGroup[] }) {
  return (
    <div className="flex flex-col gap-5">
      {groups.map((g) => {
        const approved = g.lines.filter((l) => l.review_status === "approved").length
        const pending = g.lines.filter((l) => l.review_status === "pending").length
        return (
          <section key={g.key} className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {g.key === "care_plus" ? <IconShieldCheck className="size-4 text-primary" /> : <IconCertificate className="size-4 text-muted-foreground" />}
              <h3 className="font-medium">{g.title}</h3>
              <span className="text-sm text-muted-foreground">
                {pending ? `${pending} to check · ` : ""}
                {approved} of {g.lines.length} approved
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{g.description}</p>
            <ItemGroup className="gap-2">
              {g.lines.map((l) => (
                <Line key={l.id} line={l} />
              ))}
            </ItemGroup>
          </section>
        )
      })}
    </div>
  )
}

function Line({ line }: { line: ReviewLine }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const keys = checksFor(line.care_plus)
  const issues = line.checks ? keys.filter((c) => line.checks![c.key] === "issue").length : 0
  const undo = () =>
    start(async () => {
      const res = await reviewItem(line.id, "pending", "")
      if (!res.ok) return void toast.error(res.error)
      toast.success("Check undone")
      router.refresh()
    })

  return (
    <Item
      variant="outline"
      size="sm"
      className={line.editable ? "cursor-pointer items-start hover:bg-muted/50" : "items-start"}
      onClick={(e) => {
        // Clicking anywhere on the product opens its checklist; the Undo button keeps its own click.
        if (line.editable && !(e.target as HTMLElement).closest("button")) setOpen(true)
      }}
    >
      <ItemContent>
        <ItemTitle className="flex-wrap">
          {line.product_name}
          <span className="font-normal text-muted-foreground">{categoryLabel(line.category)}</span>
          <ReviewBadge status={line.review_status} />
        </ItemTitle>
        <ItemDescription className="line-clamp-none">
          {line.qty_used} used at site of {line.qty_purchased} bought · invoice {line.invoice_number}
          {line.checks && ` · ${issues ? `${issues} issue${issues === 1 ? "" : "s"}` : "all checks OK"}`}
          {line.reviewed && (
            <>
              <br />
              {line.reviewed}
            </>
          )}
          {line.review_note && (
            <>
              <br />“{line.review_note}”
            </>
          )}
        </ItemDescription>
      </ItemContent>
      {line.editable && (
        <ItemActions className="flex-wrap justify-end">
          {line.review_status !== "pending" && (
            <Button size="sm" variant="ghost" disabled={pending} onClick={undo}>
              {pending ? <Spinner data-icon="inline-start" /> : <IconArrowBackUp data-icon="inline-start" />}
              Undo
            </Button>
          )}
          <Button size="sm" variant={line.review_status === "pending" ? "outline" : "ghost"} onClick={() => setOpen(true)}>
            <IconListCheck data-icon="inline-start" />
            {line.review_status === "pending" ? "Check" : "Review"}
            <IconChevronRight data-icon="inline-end" />
          </Button>
          {open && <CheckDrawer line={line} open={open} onOpenChange={setOpen} />}
        </ItemActions>
      )}
    </Item>
  )
}

/** The backend verification checklist for one product, then its decision. */
function CheckDrawer({ line, open, onOpenChange }: { line: ReviewLine; open: boolean; onOpenChange: (o: boolean) => void }) {
  const keys = checksFor(line.care_plus)
  const [checks, setChecks] = useState<Partial<Record<string, VerificationResult>>>(line.checks ?? line.suggested)
  const [decision, setDecision] = useState<"approved" | "rejected" | "">(line.review_status === "pending" ? "" : line.review_status)
  const [note, setNote] = useState(line.review_note ?? "")
  return (
    <ActionDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={`Check ${line.product_name}`}
      description="Check each item against the invoice, documents and photos. Your name is recorded with the check."
      submitLabel="Save check"
      destructive={decision === "rejected"}
      success={decision === "rejected" ? `${line.product_name} rejected` : `${line.product_name} approved`}
      run={async () => {
        if (!decision) return { ok: false, error: "Choose approve or reject for this product." }
        return reviewItem(line.id, decision, note, checks as Record<string, VerificationResult>)
      }}
    >
      <div className="flex flex-col gap-4">
        {keys.map((c) => (
          <Field key={c.key}>
            <FieldLabel>{c.label}</FieldLabel>
            <ToggleGroup
              variant="outline"
              spacing={2}
              value={checks[c.key] ? [checks[c.key]!] : []}
              onValueChange={(v) => setChecks((prev) => ({ ...prev, [c.key]: (v as VerificationResult[])[0] }))}
              className="w-full"
            >
              <ToggleGroupItem value="ok" className="h-10 flex-1">
                OK
              </ToggleGroupItem>
              <ToggleGroupItem value="issue" className="h-10 flex-1">
                Issue
              </ToggleGroupItem>
            </ToggleGroup>
          </Field>
        ))}
        <Field>
          <FieldLabel>Decision for this product</FieldLabel>
          <ToggleGroup
            variant="outline"
            spacing={2}
            value={decision ? [decision] : []}
            onValueChange={(v) => setDecision(((v as string[])[0] as "approved" | "rejected") ?? "")}
            className="w-full"
          >
            <ToggleGroupItem value="approved" className="h-10 flex-1">
              Approve
            </ToggleGroupItem>
            <ToggleGroupItem value="rejected" className="h-10 flex-1">
              Reject
            </ToggleGroupItem>
          </ToggleGroup>
        </Field>
      </div>
      <FormField label="Remarks" htmlFor={`check-${line.id}`} description="Optional.">
        <Textarea id={`check-${line.id}`} rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </FormField>
    </ActionDrawer>
  )
}

export function ReviewBadge({ status }: { status: ItemReview }) {
  if (status === "approved") return <Badge>{ITEM_REVIEW.approved}</Badge>
  if (status === "rejected") return <Badge variant="destructive">{ITEM_REVIEW.rejected}</Badge>
  return <Badge variant="outline">{ITEM_REVIEW.pending}</Badge>
}
