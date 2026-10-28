import { COMPLAINT_TYPES } from "@/lib/domain/constants"
import type { FieldErrors, FileRef } from "@/lib/domain/registration"

export const MIN_CLAIM_PHOTOS = 2
export const MAX_CLAIM_PHOTOS = 10

export type ClaimInput = {
  item_id: string
  complaint_type: string
  affected_qty: string
  noticed_on: string
  description: string
  photos: FileRef[]
  videos: FileRef[]
  declaration: boolean
}

export const CLAIM_DECLARATION =
  "I declare that the information and photos are true and relate to the registered site. I will allow Sylvan's authorised representatives to inspect the site and take samples if needed. I understand that once this complaint is registered, this SylvanCare+ warranty becomes inactive for further claims."

export type ClaimItemRef = { id: string; product_name: string; covered: number; care_start: string | null }

export function validateClaim(p: ClaimInput, items: ClaimItemRef[], today: string): FieldErrors {
  const e: FieldErrors = {}
  const item = items.find((i) => i.id === p.item_id)
  if (!item) e.item_id = "Choose the affected product"
  if (!COMPLAINT_TYPES.includes(p.complaint_type as (typeof COMPLAINT_TYPES)[number])) e.complaint_type = "Choose the type of problem"
  const qty = Number(p.affected_qty)
  if (!p.affected_qty) e.affected_qty = "Enter the approximate number of affected sheets"
  else if (!Number.isInteger(qty) || qty < 1) e.affected_qty = "Enter a whole number"
  else if (item && qty > item.covered) e.affected_qty = `Can't be more than the ${item.covered} covered sheets`
  if (!p.noticed_on) e.noticed_on = "When did you notice the problem?"
  else if (p.noticed_on > today) e.noticed_on = "Can't be in the future"
  else if (item?.care_start && p.noticed_on < item.care_start) e.noticed_on = "Can't be before your warranty started"
  if (!p.description.trim()) e.description = "Describe the problem"
  if (p.photos.length < MIN_CLAIM_PHOTOS) e.photos = `Add at least ${MIN_CLAIM_PHOTOS} photos of the affected area`
  if (p.photos.length > MAX_CLAIM_PHOTOS) e.photos = `Up to ${MAX_CLAIM_PHOTOS} photos`
  if (p.videos.length > 1) e.videos = "Add one video at most"
  if (!p.declaration) e.declaration = "Please confirm the declaration"
  return e
}
