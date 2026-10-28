-- Registrations submitted before per-product review put SylvanCare+ products on the standard e-warranty too,
-- and could have one e-warranty per certificate type. For e-warranties not yet decided, apply the new rule:
-- SylvanCare+ products are on the SylvanCare+ certificate only, and one standard e-warranty per registration.

delete from public.e_warranty_items ei
using public.e_warranties e, public.registration_items i
where e.id = ei.e_warranty_id and e.status = 'pending_review' and i.id = ei.item_id and i.care_plus;

-- Fold the remaining pending e-warranties of a registration into its earliest one.
with keep as (
  select distinct on (registration_id) registration_id, id
  from public.e_warranties
  where status = 'pending_review'
  order by registration_id, created_at, id
)
update public.e_warranty_items ei set e_warranty_id = keep.id
from public.e_warranties e, keep
where ei.e_warranty_id = e.id and e.status = 'pending_review' and e.registration_id = keep.registration_id and e.id <> keep.id;

-- Emptied ones go; those with audit history (which can't be deleted) are closed as replaced.
delete from public.e_warranties e
where e.status = 'pending_review'
  and not exists (select 1 from public.e_warranty_items ei where ei.e_warranty_id = e.id)
  and not exists (select 1 from public.audit_events a where a.e_warranty_id = e.id);
update public.e_warranties e set status = 'rejected', reject_reason = 'Replaced by the single standard e-warranty for this registration.'
where e.status = 'pending_review' and not exists (select 1 from public.e_warranty_items ei where ei.e_warranty_id = e.id);
