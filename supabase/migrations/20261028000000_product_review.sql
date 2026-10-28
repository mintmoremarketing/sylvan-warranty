-- Per-product review and one certificate per programme group.
--
-- Every product line on a registration is checked on its own (approved / rejected). When the checks are
-- done, two certificates come out of one form: the SylvanCare+ certificate with the approved SylvanCare+
-- products, and one standard e-warranty with the approved standard products.

alter table public.registration_items
  add column review_status text not null default 'pending' check (review_status in ('pending', 'approved', 'rejected')),
  add column review_note text,
  add column reviewed_by uuid references public.staff (id),
  add column reviewed_at timestamptz;

-- Lines decided before this change count as approved.
update public.registration_items i set review_status = 'approved'
from public.registrations r
where r.id = i.registration_id and r.status = 'active' and i.care_plus;
update public.registration_items i set review_status = 'approved'
from public.e_warranties e
where e.registration_id = i.registration_id and e.status = 'issued' and i.standard and not i.care_plus;

-- A standard e-warranty now holds every standard product of the registration, so each line carries its
-- own certificate type (for its terms) and points back to the product line it covers.
alter table public.e_warranty_items
  add column item_id uuid references public.registration_items (id) on delete cascade,
  add column program text references public.warranty_programs (code);

update public.e_warranty_items ei set program = e.program
from public.e_warranties e where e.id = ei.e_warranty_id;
update public.e_warranty_items ei set item_id = i.id
from public.e_warranties e, public.registration_items i
where e.id = ei.e_warranty_id and i.registration_id = e.registration_id and i.product_id = ei.product_id;

-- Dealer details are typed on the form (name and phone); there is no dealer list or GSTIN any more.
alter table public.registration_invoices drop column dealer_id, drop column dealer_gstin;

-- A SylvanCare+ product goes on the SylvanCare+ certificate only; it falls back to the standard
-- e-warranty when it doesn't qualify for SylvanCare+.
create or replace function public.submit_registration(p jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_reg_id uuid;
  v_wrn text := public.next_number('WRN');
  v_invoice jsonb;
  v_invoice_id uuid;
  v_item jsonb;
  v_file jsonb;
  v_position int := 0;
  v_ew_id uuid;
  v_first record;
begin
  insert into registrations (
    wrn, customer_id, channel, created_by_staff,
    owner_name, owner_email, owner_mobile, site_address, city, district, state, pincode,
    property_type, installation_status, application_areas, carpenter_name, carpenter_mobile,
    referred_by, referrer_name, referrer_mobile, referrer_email,
    care_plus, status, sla_due_at
  ) values (
    v_wrn,
    (p->>'customer_id')::uuid,
    p->>'channel',
    nullif(p->>'created_by_staff', '')::uuid,
    p->>'owner_name', p->>'owner_email', p->>'owner_mobile', p->>'site_address',
    p->>'city', p->>'district', p->>'state', p->>'pincode',
    nullif(p->>'property_type', ''),
    nullif(p->>'installation_status', ''),
    array(select jsonb_array_elements_text(coalesce(p->'application_areas', '[]'::jsonb))),
    nullif(p->>'carpenter_name', ''), nullif(p->>'carpenter_mobile', ''),
    nullif(p->>'referred_by', ''), nullif(p->>'referrer_name', ''),
    nullif(p->>'referrer_mobile', ''), nullif(p->>'referrer_email', ''),
    (p->>'care_plus')::boolean,
    p->>'status',
    nullif(p->>'sla_due_at', '')::timestamptz
  ) returning id into v_reg_id;

  for v_invoice in select * from jsonb_array_elements(p->'invoices') loop
    v_position := v_position + 1;
    insert into registration_invoices (registration_id, position, invoice_number, invoice_date, dealer_name, dealer_phone, batch_code)
    values (
      v_reg_id, v_position, v_invoice->>'invoice_number', (v_invoice->>'invoice_date')::date,
      v_invoice->>'dealer_name', nullif(v_invoice->>'dealer_phone', ''), nullif(v_invoice->>'batch_code', '')
    ) returning id into v_invoice_id;

    for v_file in select * from jsonb_array_elements(v_invoice->'files') loop
      insert into documents (registration_id, invoice_id, kind, path, file_name, content_type,
                             size_bytes, sha256, uploaded_by_customer, uploaded_by_staff)
      values (v_reg_id, v_invoice_id, 'invoice', v_file->>'path', v_file->>'file_name',
              v_file->>'content_type', (v_file->>'size_bytes')::bigint, nullif(v_file->>'sha256', ''),
              nullif(p->>'uploaded_by_customer', '')::uuid, nullif(p->>'created_by_staff', '')::uuid);
    end loop;

    for v_item in select * from jsonb_array_elements(v_invoice->'items') loop
      insert into registration_items (registration_id, invoice_id, product_id, product_name, category,
                                      qty_purchased, qty_used, care_plus, standard)
      values (v_reg_id, v_invoice_id, (v_item->>'product_id')::uuid, v_item->>'product_name',
              v_item->>'category', (v_item->>'qty_purchased')::int, (v_item->>'qty_used')::int,
              (v_item->>'care_plus')::boolean, (v_item->>'standard')::boolean);
    end loop;
  end loop;

  for v_file in select * from jsonb_array_elements(coalesce(p->'site_photos', '[]'::jsonb)) loop
    insert into documents (registration_id, kind, path, file_name, content_type, size_bytes, sha256,
                           uploaded_by_customer, uploaded_by_staff)
    values (v_reg_id, 'site_photo', v_file->>'path', v_file->>'file_name', v_file->>'content_type',
            (v_file->>'size_bytes')::bigint, nullif(v_file->>'sha256', ''),
            nullif(p->>'uploaded_by_customer', '')::uuid, nullif(p->>'created_by_staff', '')::uuid);
  end loop;

  -- One standard e-warranty for all the standard products in the form.
  select inv.invoice_number, inv.invoice_date, inv.dealer_name, pr.standard_program into v_first
  from registration_items i
  join registration_invoices inv on inv.id = i.invoice_id
  join products pr on pr.id = i.product_id
  where i.registration_id = v_reg_id and i.standard
  order by inv.position, pr.sort
  limit 1;

  if v_first.invoice_number is not null then
    insert into e_warranties (registration_id, program, customer_name, customer_mobile, customer_address,
                              dealer_name, invoice_number, invoice_date)
    values (
      v_reg_id, v_first.standard_program, p->>'owner_name', p->>'owner_mobile',
      concat_ws(', ', p->>'site_address', p->>'city', p->>'district', p->>'state', p->>'pincode'),
      v_first.dealer_name, v_first.invoice_number, v_first.invoice_date
    ) returning id into v_ew_id;

    insert into e_warranty_items (e_warranty_id, item_id, program, product_id, product_name, category, qty, warranty_period, invoice_number)
    select v_ew_id, i.id, pr.standard_program, i.product_id, i.product_name, i.category, i.qty_purchased,
           pr.standard_period, inv.invoice_number
    from registration_items i
    join registration_invoices inv on inv.id = i.invoice_id
    join products pr on pr.id = i.product_id
    where i.registration_id = v_reg_id and i.standard
    order by inv.position, pr.sort;
  end if;

  insert into consents (customer_id, registration_id, kind, policy_version, statements, method,
                        assisted_by, ip, user_agent)
  values (
    (p->>'customer_id')::uuid, v_reg_id, 'registration', p->'consent'->>'policy_version',
    array(select jsonb_array_elements_text(p->'consent'->'statements')),
    p->'consent'->>'method', nullif(p->'consent'->>'assisted_by', '')::uuid,
    p->'consent'->>'ip', p->'consent'->>'user_agent'
  );

  perform public.audit_from_json(jsonb_build_object(
    'registration_id', v_reg_id,
    'entity', 'registration',
    'action', 'submitted',
    'to_status', p->>'status',
    'actor_staff', p->>'created_by_staff',
    'actor_customer', p->>'uploaded_by_customer',
    'actor_label', p->>'actor_label',
    'data', jsonb_build_object('channel', p->>'channel', 'consent_method', p->'consent'->>'method'),
    'visible_to_customer', true,
    'customer_message', 'Registration submitted'
  ));

  return v_wrn;
end $$;

revoke execute on function public.submit_registration(jsonb) from public, anon, authenticated;
grant execute on function public.submit_registration(jsonb) to service_role;
