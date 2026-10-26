-- Align roles and the registration workflow exactly with Sylvan's brief.

-- Roles are the teams the brief names. Dealer and sales-team assisted registration go through
-- Customer Care / the authorised HO team, so there is no dealer login.
alter table public.staff drop constraint staff_roles_check;
alter table public.staff add constraint staff_roles_check check (
  roles <@ array['admin', 'customer_care', 'verifier', 'approver', 'inspector',
                 'sales_coordinator', 'technical', 'finance', 'management']::text[]
  and cardinality(roles) > 0
);

-- Brief §7: on approval the status moves to APPROVED, then the system activates the warranty
-- (WARRANTY ACTIVE). Both are recorded.
alter table public.registrations drop constraint registrations_status_check;
alter table public.registrations add constraint registrations_status_check check (status in (
  'not_applicable', 'received', 'under_verification', 'info_required', 'inspection_required',
  'inspector_assigned', 'inspection_completed', 'pending_approval', 'approved', 'active', 'rejected'
));

-- Brief §3: the backend team's verification checklist, and who did it ("every backend review
-- must identify the employee/user conducting the verification").
alter table public.registrations
  add column verification jsonb,
  add column verified_by uuid references public.staff (id),
  add column verified_at timestamptz;

-- "Toll-free / customer-care-assisted claim": Customer Care records the customer's declaration on the call.
alter table public.consents drop constraint consents_method_check;
alter table public.consents add constraint consents_method_check
  check (method in ('email_otp_login', 'email_otp_assisted', 'customer_care_call'));
