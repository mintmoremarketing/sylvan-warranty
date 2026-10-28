-- The backend verification checklist is answered for each product (OK / Issue per check) before that
-- product is approved or rejected. The registration's own verification is the combined result.
alter table public.registration_items add column review_checks jsonb;
