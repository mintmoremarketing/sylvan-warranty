"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { IconArrowBackUp, IconCertificate, IconCheck, IconShieldCheck, IconX } from "@tabler/icons-react"

import { reviewItem } from "@/app/console/(app)/registrations/actions"
import { ActionDrawer } from "@/components/console/action-drawer"
import { FormField } from "@/components/form-field"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { categoryLabel, ITEM_REVIEW, type ItemReview } from "@/lib/domain/constants"

export type ReviewLine = {
  id: string
  product_name: string
  category: string
  qty_purchased: number
  qty_used: number
  invoice_number: string
  review_status: ItemReview
  review_note: string | null
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
  const [note, setNote] = useState("")
  const [pending, start] = useTransition()
  const decide = (decision: "approved" | "pending") =>
    start(async () => {
      const res = await reviewItem(line.id, decision, "")
      if (!res.ok) return void toast.error(res.error)
      toast.success(decision === "approved" ? `${line.product_name} approved` : "Check undone")
      router.refresh()
    })

  return (
    <Item variant="outline" size="sm" className="items-start">
      <ItemContent>
        <ItemTitle className="flex-wrap">
          {line.product_name}
          <span className="font-normal text-muted-foreground">{categoryLabel(line.category)}</span>
          <ReviewBadge status={line.review_status} />
        </ItemTitle>
        <ItemDescription className="line-clamp-none">
          {line.qty_used} used at site of {line.qty_purchased} bought · invoice {line.invoice_number}
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
          {line.review_status === "pending" ? (
            <>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => decide("approved")}>
                {pending ? <Spinner data-icon="inline-start" /> : <IconCheck data-icon="inline-start" />}
                Approve
              </Button>
              <ActionDrawer
                trigger={<Button size="sm" variant="ghost" className="text-destructive" />}
                label={<><IconX data-icon="inline-start" />Reject</>}
                title={`Reject ${line.product_name}`}
                description="This product is left off the certificate. The other products are not affected."
                submitLabel="Reject product"
                destructive
                success={`${line.product_name} rejected`}
                run={() => reviewItem(line.id, "rejected", note)}
              >
                <FormField label="Reason" htmlFor={`reject-${line.id}`} description="Optional.">
                  <Textarea id={`reject-${line.id}`} rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
                </FormField>
              </ActionDrawer>
            </>
          ) : (
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => decide("pending")}>
              {pending ? <Spinner data-icon="inline-start" /> : <IconArrowBackUp data-icon="inline-start" />}
              Undo
            </Button>
          )}
        </ItemActions>
      )}
    </Item>
  )
}

export function ReviewBadge({ status }: { status: ItemReview }) {
  if (status === "approved") return <Badge>{ITEM_REVIEW.approved}</Badge>
  if (status === "rejected") return <Badge variant="destructive">{ITEM_REVIEW.rejected}</Badge>
  return <Badge variant="outline">{ITEM_REVIEW.pending}</Badge>
}
