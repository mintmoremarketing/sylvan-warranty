-- SylvanCare+ & Sylvan e-Warranty — core schema.
--
-- Access model: RLS is on for every table. Customers and staff may only READ, through the
-- policies below. Every write goes through server code that checks the actor's role first and
-- uses the service-role key, with multi-row changes wrapped in the functions in the next migration.

-- ---------------------------------------------------------------------------
-- Settings & master data
-- ---------------------------------------------------------------------------

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table public.holidays (
  day date primary key,
  name text not null
);

create table public.warranty_programs (
  code text primary key,
  name text not null,
  kind text not null check (kind in ('care_plus', 'standard')),
  window_days int not null,
  certificate_title text not null,
  sort int not null default 0
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('plywood', 'blockboard', 'flush_door', 'wpc')),
  standard_program text references public.warranty_programs (code),
  standard_period text,
  lifetime_multiplier text,
  care_plus_years int check (care_plus_years > 0),
  coverage_note text,
  product_url text,
  active boolean not null default true,
  sort int not null default 0,
  unique (name, category)
);

create table public.reason_codes (
  code text primary key,
  context text not null check (context in ('registration_reject', 'claim_finding', 'claim_reject', 'no_inspection')),
  label text not null,
  requires_remarks boolean not null default false,
  sort int not null default 0
);

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------

create table public.staff (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null unique,
  phone text,
  designation text,
  roles text[] not null check (
    roles <@ array['admin', 'customer_care', 'verifier', 'approver', 'inspector',
                   'sales_coordinator', 'technical', 'finance', 'management', 'dealer']::text[]
    and cardinality(roles) > 0
  ),
  regions text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.dealers (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  name text not null,
  city text,
  state text,
  gstin text unique check (gstin is null or gstin ~ '^[0-9]{2}[A-Z0-9]{10}[0-9A-Z]{3}$'),
  phone text,
  sales_coordinator_id uuid references public.staff (id) on delete set null,
  authorised boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- A customer is identified by email (login is email OTP for now). auth_user_id is linked on
-- first login, so customer care can register on someone's behalf before they ever sign in.
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete set null,
  email text not null unique check (email = lower(email)),
  full_name text,
  mobile text check (mobile is null or mobile ~ '^[6-9][0-9]{9}$'),
  mobile_verified boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Registrations
-- ---------------------------------------------------------------------------

create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  wrn text not null unique,
  customer_id uuid not null references public.customers (id),
  channel text not null default 'self' check (channel in ('self', 'customer_care', 'sales', 'dealer')),
  created_by_staff uuid references public.staff (id),

  owner_name text not null,
  owner_email text not null,
  owner_mobile text not null check (owner_mobile ~ '^[6-9][0-9]{9}$'),
  site_address text not null,
  city text not null,
  district text not null,
  state text not null,
  pincode text not null check (pincode ~ '^[1-9][0-9]{5}$'),

  property_type text,
  installation_status text check (installation_status in ('not_started', 'in_progress', 'completed')),
  application_areas text[] not null default '{}',
  carpenter_name text,
  carpenter_mobile text,

  referred_by text check (referred_by in ('architect', 'interior_designer', 'sales_person', 'other')),
  referrer_name text,
  referrer_mobile text,
  referrer_email text,

  -- SylvanCare+ workflow. 'not_applicable' when no line qualifies for SylvanCare+.
  care_plus boolean not null,
  status text not null check (status in (
    'not_applicable', 'received', 'under_verification', 'info_required', 'inspection_required',
    'inspector_assigned', 'inspection_completed', 'pending_approval', 'active', 'rejected'
  )),
  inspection_needed boolean,
  inspection_reason text,
  sla_due_at timestamptz,
  activated_at timestamptz,
  claim_locked_at timestamptz,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index registrations_customer_idx on public.registrations (customer_id, submitted_at desc);
create index registrations_status_idx on public.registrations (status, submitted_at);
create index registrations_mobile_idx on public.registrations (owner_mobile);
create index registrations_pincode_idx on public.registrations (pincode);

create table public.registration_invoices (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations (id) on delete cascade,
  position int not null,
  invoice_number text not null,
  invoice_number_norm text generated always as (upper(regexp_replace(invoice_number, '[^A-Za-z0-9]', '', 'g'))) stored,
  invoice_date date not null,
  dealer_id uuid references public.dealers (id),
  dealer_name text not null,
  dealer_phone text,
  dealer_gstin text,
  batch_code text,
  unique (registration_id, position)
);

create index registration_invoices_number_idx on public.registration_invoices (invoice_number_norm);

create table public.registration_items (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations (id) on delete cascade,
  invoice_id uuid not null references public.registration_invoices (id) on delete cascade,
  product_id uuid not null references public.products (id),
  product_name text not null,
  category text not null,
  qty_purchased int not null check (qty_purchased between 1 and 100000),
  qty_used int not null check (qty_used between 0 and 100000),
  care_plus boolean not null,
  standard boolean not null,
  -- SylvanCare+ coverage, filled on activation (calculated from the invoice date, per the policy).
  care_start date,
  care_expiry date,
  utilised_qty int not null default 0,
  constraint used_within_purchased check (qty_used <= qty_purchased)
);

create index registration_items_registration_idx on public.registration_items (registration_id);

-- Every file in the system: invoices, site photos, inspection evidence, claim media, lab reports.
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid references public.registrations (id) on delete cascade,
  invoice_id uuid references public.registration_invoices (id) on delete cascade,
  claim_id uuid,
  inspection_id uuid,
  info_request_id uuid,
  kind text not null,
  path text not null unique,
  file_name text not null,
  content_type text not null,
  size_bytes bigint not null,
  sha256 text,
  uploaded_by_customer uuid references public.customers (id),
  uploaded_by_staff uuid references public.staff (id),
  created_at timestamptz not null default now()
);

create index documents_registration_idx on public.documents (registration_id);
create index documents_claim_idx on public.documents (claim_id);
create index documents_sha_idx on public.documents (sha256);

create table public.info_requests (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid references public.registrations (id) on delete cascade,
  claim_id uuid,
  requested_items text[] not null,
  remarks text not null,
  requested_by uuid not null references public.staff (id),
  requested_at timestamptz not null default now(),
  response_note text,
  responded_at timestamptz
);

create table public.fraud_flags (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid references public.registrations (id) on delete cascade,
  claim_id uuid,
  code text not null,
  severity text not null check (severity in ('info', 'warning', 'high')),
  detail text not null,
  related_wrn text,
  status text not null default 'open' check (status in ('open', 'cleared')),
  cleared_by uuid references public.staff (id),
  cleared_reason text,
  cleared_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id),
  registration_id uuid references public.registrations (id) on delete cascade,
  claim_id uuid,
  kind text not null check (kind in ('registration', 'claim')),
  policy_version text not null,
  statements text[] not null,
  method text not null check (method in ('email_otp_login', 'email_otp_assisted')),
  assisted_by uuid references public.staff (id),
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

-- One-time codes for assisted-registration consent (customer reads the emailed code to staff).
create table public.consent_otps (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code_hash text not null,
  draft jsonb not null,
  staff_id uuid not null references public.staff (id),
  attempts int not null default 0,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Standard e-warranties (reviewed and issued by the dealer's sales coordinator)
-- ---------------------------------------------------------------------------

create table public.e_warranties (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations (id) on delete cascade,
  program text not null references public.warranty_programs (code),
  number text unique,
  status text not null default 'pending_review' check (status in ('pending_review', 'issued', 'rejected')),
  customer_name text not null,
  customer_mobile text not null,
  customer_address text not null,
  dealer_name text not null,
  invoice_number text not null,
  invoice_date date not null,
  coordinator_id uuid references public.staff (id),
  issued_by uuid references public.staff (id),
  issued_at timestamptz,
  reject_reason text,
  created_at timestamptz not null default now(),
  unique (registration_id, program)
);

create table public.e_warranty_items (
  id uuid primary key default gen_random_uuid(),
  e_warranty_id uuid not null references public.e_warranties (id) on delete cascade,
  product_id uuid not null references public.products (id),
  product_name text not null,
  category text not null,
  qty int not null check (qty > 0),
  warranty_period text not null,
  invoice_number text not null
);

-- ---------------------------------------------------------------------------
-- Inspections (registration verification visits and claim inspections)
-- ---------------------------------------------------------------------------

create table public.inspections (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations (id) on delete cascade,
  claim_id uuid,
  kind text not null check (kind in ('registration', 'claim')),
  inspector_id uuid not null references public.staff (id),
  assigned_by uuid not null references public.staff (id),
  scheduled_at timestamptz,
  status text not null default 'assigned' check (status in ('assigned', 'scheduled', 'completed', 'revisit_required', 'cancelled')),
  form_version text,
  answers jsonb not null default '{}',
  geo_lat double precision,
  geo_lng double precision,
  geo_accuracy_m double precision,
  customer_ack_name text,
  customer_ack_at timestamptz,
  inspector_declared_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);

create index inspections_inspector_idx on public.inspections (inspector_id, status);

-- ---------------------------------------------------------------------------
-- Claims
-- ---------------------------------------------------------------------------

create table public.claims (
  id uuid primary key default gen_random_uuid(),
  claim_no text not null unique,
  registration_id uuid not null unique references public.registrations (id),
  customer_id uuid not null references public.customers (id),
  item_id uuid not null references public.registration_items (id),
  complaint_type text not null,
  affected_qty int not null check (affected_qty > 0),
  noticed_on date not null,
  description text not null,
  channel text not null default 'self' check (channel in ('self', 'customer_care')),
  status text not null default 'received' check (status in (
    'received', 'under_review', 'info_required', 'inspection_required', 'inspection_scheduled',
    'inspection_completed', 'technical_review', 'further_testing', 'approved', 'partially_approved',
    'rejected', 'settlement_in_progress', 'settlement_completed', 'closed'
  )),
  screening jsonb not null default '{}',
  finding_code text,
  decision text check (decision in ('approved', 'partially_approved', 'rejected')),
  decision_remarks text,
  decided_by uuid references public.staff (id),
  decided_at timestamptz,
  approved_qty int,
  sla_due_at timestamptz,
  closed_at timestamptz,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.documents add constraint documents_claim_fk foreign key (claim_id) references public.claims (id) on delete cascade;
alter table public.documents add constraint documents_inspection_fk foreign key (inspection_id) references public.inspections (id) on delete cascade;
alter table public.documents add constraint documents_info_request_fk foreign key (info_request_id) references public.info_requests (id) on delete set null;
alter table public.info_requests add constraint info_requests_claim_fk foreign key (claim_id) references public.claims (id) on delete cascade;
alter table public.inspections add constraint inspections_claim_fk foreign key (claim_id) references public.claims (id) on delete cascade;
alter table public.fraud_flags add constraint fraud_flags_claim_fk foreign key (claim_id) references public.claims (id) on delete cascade;
alter table public.consents add constraint consents_claim_fk foreign key (claim_id) references public.claims (id) on delete cascade;

create table public.samples (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims (id) on delete cascade,
  seal_no text not null unique,
  description text not null,
  collected_by uuid not null references public.staff (id),
  collected_at timestamptz not null,
  customer_ack boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.custody_events (
  id uuid primary key default gen_random_uuid(),
  sample_id uuid not null references public.samples (id) on delete cascade,
  event text not null,
  location text not null,
  handled_by text not null,
  at timestamptz not null,
  recorded_by uuid not null references public.staff (id),
  created_at timestamptz not null default now()
);

create table public.lab_reports (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims (id) on delete cascade,
  sample_id uuid references public.samples (id) on delete set null,
  lab_name text not null,
  report_no text,
  report_date date not null,
  result text not null check (result in ('defect_confirmed', 'no_defect', 'inconclusive')),
  summary text not null,
  document_id uuid references public.documents (id),
  recorded_by uuid not null references public.staff (id),
  created_at timestamptz not null default now()
);

create table public.compensation_sheets (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null unique references public.claims (id) on delete cascade,
  lines jsonb not null,
  total_payable numeric(12, 2) not null check (total_payable >= 0),
  prepared_by uuid not null references public.staff (id),
  prepared_at timestamptz not null default now(),
  approved_by uuid references public.staff (id),
  approved_at timestamptz,
  finance_approved_by uuid references public.staff (id),
  finance_approved_at timestamptz
);

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null unique references public.claims (id) on delete cascade,
  mode text not null check (mode in ('reimbursement', 'replacement', 'repair', 'cash')),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  bank_verified boolean not null default false,
  bank_reference text,
  replacement_details text,
  payment_reference text,
  customer_accepted_at timestamptz,
  restoration_confirmed_at timestamptz,
  notes text,
  updated_by uuid references public.staff (id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Audit, messages, callbacks
-- ---------------------------------------------------------------------------

create table public.audit_events (
  id bigint generated always as identity primary key,
  registration_id uuid references public.registrations (id) on delete restrict,
  claim_id uuid references public.claims (id) on delete restrict,
  e_warranty_id uuid references public.e_warranties (id) on delete restrict,
  entity text not null,
  action text not null,
  from_status text,
  to_status text,
  actor_staff uuid references public.staff (id),
  actor_customer uuid references public.customers (id),
  actor_label text not null,
  remarks text,
  data jsonb not null default '{}',
  visible_to_customer boolean not null default false,
  customer_message text,
  created_at timestamptz not null default now()
);

create index audit_events_registration_idx on public.audit_events (registration_id, created_at);
create index audit_events_claim_idx on public.audit_events (claim_id, created_at);

-- The audit trail can never be edited or deleted, not even by the service role.
create function public.audit_events_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'audit_events is append-only';
end $$;

create trigger audit_events_no_update before update or delete on public.audit_events
  for each row execute function public.audit_events_immutable();

create table public.message_log (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('email', 'sms', 'whatsapp')),
  template text not null,
  recipient text not null,
  subject text,
  body text not null,
  registration_id uuid references public.registrations (id) on delete set null,
  claim_id uuid references public.claims (id) on delete set null,
  status text not null check (status in ('sent', 'logged', 'failed')),
  error text,
  created_at timestamptz not null default now()
);

create table public.callback_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mobile text not null check (mobile ~ '^[6-9][0-9]{9}$'),
  email text,
  topic text not null,
  message text,
  status text not null default 'open' check (status in ('open', 'done')),
  handled_by uuid references public.staff (id),
  handled_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Numbering: gap-free sequence per series per year (WRN/26/000124, EW/26/000001)
-- ---------------------------------------------------------------------------

create table public.counters (
  series text not null,
  year int not null,
  value int not null,
  primary key (series, year)
);

create function public.next_number(p_series text) returns text
language plpgsql as $$
declare
  v_year int := extract(year from (now() at time zone 'Asia/Kolkata'))::int;
  v_value int;
begin
  insert into public.counters (series, year, value) values (p_series, v_year, 1)
  on conflict (series, year) do update set value = public.counters.value + 1
  returning value into v_value;
  return p_series || '/' || lpad((v_year % 100)::text, 2, '0') || '/' || lpad(v_value::text, 6, '0');
end $$;

-- ---------------------------------------------------------------------------
-- Read access (RLS). No insert/update/delete policies: writes are server-only.
-- ---------------------------------------------------------------------------

create function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where id = auth.uid() and active);
$$;

create function public.current_customer_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.customers where auth_user_id = auth.uid();
$$;

create function public.owns_registration(p_registration uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.registrations r
    where r.id = p_registration and r.customer_id = public.current_customer_id()
  );
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'app_settings', 'holidays', 'warranty_programs', 'products', 'reason_codes', 'staff', 'dealers',
    'customers', 'registrations', 'registration_invoices', 'registration_items', 'documents',
    'info_requests', 'fraud_flags', 'consents', 'consent_otps', 'e_warranties', 'e_warranty_items',
    'inspections', 'claims', 'samples', 'custody_events', 'lab_reports', 'compensation_sheets',
    'settlements', 'audit_events', 'message_log', 'callback_requests', 'counters'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Public reference data
create policy "read programs" on public.warranty_programs for select using (true);
create policy "read products" on public.products for select using (active or public.is_staff());
create policy "read reason codes" on public.reason_codes for select using (true);
create policy "read dealers" on public.dealers for select using (auth.uid() is not null);

-- Staff-only tables
create policy "staff read settings" on public.app_settings for select using (public.is_staff());
create policy "staff read holidays" on public.holidays for select using (public.is_staff());
create policy "staff read staff" on public.staff for select using (public.is_staff() or id = auth.uid());
create policy "staff read fraud flags" on public.fraud_flags for select using (public.is_staff());
create policy "staff read samples" on public.samples for select using (public.is_staff());
create policy "staff read custody" on public.custody_events for select using (public.is_staff());
create policy "staff read lab reports" on public.lab_reports for select using (public.is_staff());
create policy "staff read compensation" on public.compensation_sheets for select using (public.is_staff());
create policy "staff read messages" on public.message_log for select using (public.is_staff());
create policy "staff read callbacks" on public.callback_requests for select using (public.is_staff());
create policy "staff read consents" on public.consents for select using (public.is_staff());

-- Customer-owned data
create policy "read own customer" on public.customers for select
  using (auth_user_id = auth.uid() or public.is_staff());
create policy "read own registrations" on public.registrations for select
  using (customer_id = public.current_customer_id() or public.is_staff());
create policy "read own invoices" on public.registration_invoices for select
  using (public.owns_registration(registration_id) or public.is_staff());
create policy "read own items" on public.registration_items for select
  using (public.owns_registration(registration_id) or public.is_staff());
create policy "read own documents" on public.documents for select
  using (public.owns_registration(registration_id) or public.is_staff());
create policy "read own info requests" on public.info_requests for select
  using (public.owns_registration(registration_id) or public.is_staff()
         or exists (select 1 from public.claims c where c.id = claim_id and c.customer_id = public.current_customer_id()));
create policy "read own e-warranties" on public.e_warranties for select
  using (public.owns_registration(registration_id) or public.is_staff());
create policy "read own e-warranty items" on public.e_warranty_items for select
  using (public.is_staff() or exists (
    select 1 from public.e_warranties e where e.id = e_warranty_id and public.owns_registration(e.registration_id)
  ));
create policy "read own inspections" on public.inspections for select
  using (public.owns_registration(registration_id) or public.is_staff());
create policy "read own claims" on public.claims for select
  using (customer_id = public.current_customer_id() or public.is_staff());
create policy "read own settlements" on public.settlements for select
  using (public.is_staff() or exists (
    select 1 from public.claims c where c.id = claim_id and c.customer_id = public.current_customer_id()
  ));
create policy "read audit" on public.audit_events for select
  using (public.is_staff() or (visible_to_customer and (
    public.owns_registration(registration_id)
    or exists (select 1 from public.claims c where c.id = claim_id and c.customer_id = public.current_customer_id())
  )));

-- ---------------------------------------------------------------------------
-- Storage: one private bucket; clients upload only through server-issued signed URLs.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents', 'documents', false, 104857600,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
        'video/mp4', 'video/quicktime', 'video/webm']
)
on conflict (id) do nothing;
