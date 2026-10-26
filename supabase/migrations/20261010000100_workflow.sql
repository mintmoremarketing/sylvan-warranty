-- Workflow functions. Each one runs in a single transaction so a status change can never be
-- saved without its audit event. The app validates input and checks roles before calling them;
-- they are executable by the service role only.

create function public.audit_from_json(p jsonb) returns void
language plpgsql as $$
begin
  insert into public.audit_events (
    registration_id, claim_id, e_warranty_id, entity, action, from_status, to_status,
    actor_staff, actor_customer, actor_label, remarks, data, visible_to_customer, customer_message
  ) values (
    nullif(p->>'registration_id', '')::uuid,
    nullif(p->>'claim_id', '')::uuid,
    nullif(p->>'e_warranty_id', '')::uuid,
    p->>'entity',
    p->>'action',
    p->>'from_status',
    p->>'to_status',
    nullif(p->>'actor_staff', '')::uuid,
    nullif(p->>'actor_customer', '')::uuid,
    coalesce(p->>'actor_label', 'System'),
    p->>'remarks',
    coalesce(p->'data', '{}'::jsonb),
    coalesce((p->>'visible_to_customer')::boolean, false),
    p->>'customer_message'
  );
end $$;

-- ---------------------------------------------------------------------------
-- Registration submission
-- ---------------------------------------------------------------------------

create function public.submit_registration(p jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_reg_id uuid;
  v_wrn text := public.next_number('WRN');
  v_invoice jsonb;
  v_invoice_id uuid;
  v_item jsonb;
  v_file jsonb;
  v_position int := 0;
  v_program text;
  v_ew_id uuid;
  v_first jsonb;
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
    insert into registration_invoices (
      registration_id, position, invoice_number, invoice_date, dealer_id, dealer_name,
      dealer_phone, dealer_gstin, batch_code
    ) values (
      v_reg_id, v_position, v_invoice->>'invoice_number', (v_invoice->>'invoice_date')::date,
      nullif(v_invoice->>'dealer_id', '')::uuid, v_invoice->>'dealer_name',
      nullif(v_invoice->>'dealer_phone', ''), nullif(v_invoice->>'dealer_gstin', ''),
      nullif(v_invoice->>'batch_code', '')
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

  -- One standard e-warranty request per certificate type (Lifetime / 710-303-BB-FD / WPC).
  for v_program in
    select distinct item->>'standard_program'
    from jsonb_array_elements(p->'invoices') inv, jsonb_array_elements(inv->'items') item
    where (item->>'standard')::boolean
  loop
    select inv into v_first
    from jsonb_array_elements(p->'invoices') inv, jsonb_array_elements(inv->'items') item
    where (item->>'standard')::boolean and item->>'standard_program' = v_program
    limit 1;

    insert into e_warranties (registration_id, program, customer_name, customer_mobile, customer_address,
                              dealer_name, invoice_number, invoice_date, coordinator_id)
    values (
      v_reg_id, v_program, p->>'owner_name', p->>'owner_mobile',
      concat_ws(', ', p->>'site_address', p->>'city', p->>'district', p->>'state', p->>'pincode'),
      v_first->>'dealer_name', v_first->>'invoice_number', (v_first->>'invoice_date')::date,
      (select d.sales_coordinator_id from dealers d where d.id = nullif(v_first->>'dealer_id', '')::uuid)
    ) returning id into v_ew_id;

    insert into e_warranty_items (e_warranty_id, product_id, product_name, category, qty, warranty_period, invoice_number)
    select v_ew_id, (item->>'product_id')::uuid, item->>'product_name', item->>'category',
           (item->>'qty_purchased')::int, item->>'warranty_period', inv->>'invoice_number'
    from jsonb_array_elements(p->'invoices') inv, jsonb_array_elements(inv->'items') item
    where (item->>'standard')::boolean and item->>'standard_program' = v_program;
  end loop;

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

-- ---------------------------------------------------------------------------
-- Registration status change (optimistic: only from the listed statuses)
-- ---------------------------------------------------------------------------

create function public.transition_registration(
  p_id uuid, p_from text[], p_to text, p_set jsonb, p_event jsonb
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_from text;
begin
  select status into v_from from registrations where id = p_id for update;
  if v_from is null then raise exception 'registration_not_found'; end if;
  if not (v_from = any(p_from)) then
    raise exception 'invalid_transition: % -> %', v_from, p_to;
  end if;

  update registrations r set
    status = p_to,
    sla_due_at = case when p_set ? 'sla_due_at' then nullif(p_set->>'sla_due_at', '')::timestamptz else r.sla_due_at end,
    inspection_needed = case when p_set ? 'inspection_needed' then (p_set->>'inspection_needed')::boolean else r.inspection_needed end,
    inspection_reason = case when p_set ? 'inspection_reason' then p_set->>'inspection_reason' else r.inspection_reason end,
    updated_at = now()
  where id = p_id;

  if p_to = 'active' then
    update registrations set activated_at = now() where id = p_id;
    -- SylvanCare+ runs from the invoice date for each covered product's tenure.
    update registration_items i set
      care_start = inv.invoice_date,
      care_expiry = (inv.invoice_date + make_interval(years => p.care_plus_years) - interval '1 day')::date
    from registration_invoices inv, products p
    where i.registration_id = p_id and i.care_plus
      and inv.id = i.invoice_id and p.id = i.product_id;
  end if;

  perform public.audit_from_json(p_event || jsonb_build_object(
    'registration_id', p_id, 'entity', 'registration', 'from_status', v_from, 'to_status', p_to
  ));
end $$;

-- ---------------------------------------------------------------------------
-- Claim submission: one claim per SylvanCare+ warranty, which locks it.
-- ---------------------------------------------------------------------------

create function public.submit_claim(p jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_reg registrations%rowtype;
  v_claim_id uuid;
  v_claim_no text;
  v_file jsonb;
begin
  select * into v_reg from registrations where id = (p->>'registration_id')::uuid for update;
  if v_reg.id is null then raise exception 'registration_not_found'; end if;
  if v_reg.status <> 'active' then raise exception 'warranty_not_active'; end if;
  if v_reg.claim_locked_at is not null then raise exception 'claim_already_registered'; end if;

  v_claim_no := 'CLM/' || v_reg.wrn;

  insert into claims (claim_no, registration_id, customer_id, item_id, complaint_type, affected_qty,
                      noticed_on, description, channel, sla_due_at)
  values (v_claim_no, v_reg.id, v_reg.customer_id, (p->>'item_id')::uuid, p->>'complaint_type',
          (p->>'affected_qty')::int, (p->>'noticed_on')::date, p->>'description',
          coalesce(p->>'channel', 'self'), nullif(p->>'sla_due_at', '')::timestamptz)
  returning id into v_claim_id;

  update registrations set claim_locked_at = now(), updated_at = now() where id = v_reg.id;

  for v_file in select * from jsonb_array_elements(coalesce(p->'files', '[]'::jsonb)) loop
    insert into documents (registration_id, claim_id, kind, path, file_name, content_type, size_bytes,
                           sha256, uploaded_by_customer, uploaded_by_staff)
    values (v_reg.id, v_claim_id, v_file->>'kind', v_file->>'path', v_file->>'file_name',
            v_file->>'content_type', (v_file->>'size_bytes')::bigint, nullif(v_file->>'sha256', ''),
            nullif(p->>'uploaded_by_customer', '')::uuid, nullif(p->>'created_by_staff', '')::uuid);
  end loop;

  insert into consents (customer_id, registration_id, claim_id, kind, policy_version, statements, method, ip, user_agent)
  values (v_reg.customer_id, v_reg.id, v_claim_id, 'claim', p->'consent'->>'policy_version',
          array(select jsonb_array_elements_text(p->'consent'->'statements')),
          p->'consent'->>'method', p->'consent'->>'ip', p->'consent'->>'user_agent');

  perform public.audit_from_json(jsonb_build_object(
    'registration_id', v_reg.id, 'claim_id', v_claim_id, 'entity', 'claim', 'action', 'submitted',
    'to_status', 'received', 'actor_customer', p->>'uploaded_by_customer',
    'actor_staff', p->>'created_by_staff', 'actor_label', p->>'actor_label',
    'visible_to_customer', true, 'customer_message', 'Complaint received'
  ));

  return v_claim_no;
end $$;

-- ---------------------------------------------------------------------------
-- Claim status change
-- ---------------------------------------------------------------------------

create function public.transition_claim(
  p_id uuid, p_from text[], p_to text, p_set jsonb, p_event jsonb
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_claim claims%rowtype;
begin
  select * into v_claim from claims where id = p_id for update;
  if v_claim.id is null then raise exception 'claim_not_found'; end if;
  if not (v_claim.status = any(p_from)) then
    raise exception 'invalid_transition: % -> %', v_claim.status, p_to;
  end if;

  update claims c set
    status = p_to,
    screening = case when p_set ? 'screening' then p_set->'screening' else c.screening end,
    finding_code = case when p_set ? 'finding_code' then p_set->>'finding_code' else c.finding_code end,
    decision = case when p_set ? 'decision' then p_set->>'decision' else c.decision end,
    decision_remarks = case when p_set ? 'decision_remarks' then p_set->>'decision_remarks' else c.decision_remarks end,
    decided_by = case when p_set ? 'decided_by' then (p_set->>'decided_by')::uuid else c.decided_by end,
    decided_at = case when p_set ? 'decision' then now() else c.decided_at end,
    approved_qty = case when p_set ? 'approved_qty' then (p_set->>'approved_qty')::int else c.approved_qty end,
    sla_due_at = case when p_set ? 'sla_due_at' then nullif(p_set->>'sla_due_at', '')::timestamptz else c.sla_due_at end,
    closed_at = case when p_to = 'closed' then now() else c.closed_at end,
    updated_at = now()
  where id = p_id;

  -- Policy 2.3: compensated quantity is recorded so it can never be claimed again.
  if p_to = 'closed' and coalesce(v_claim.approved_qty, (p_set->>'approved_qty')::int) is not null then
    update registration_items set utilised_qty = utilised_qty + coalesce((p_set->>'approved_qty')::int, v_claim.approved_qty)
    where id = v_claim.item_id;
  end if;

  perform public.audit_from_json(p_event || jsonb_build_object(
    'registration_id', v_claim.registration_id, 'claim_id', p_id, 'entity', 'claim',
    'from_status', v_claim.status, 'to_status', p_to
  ));
end $$;

-- ---------------------------------------------------------------------------
-- Standard e-warranty issue (sales coordinator)
-- ---------------------------------------------------------------------------

create function public.issue_e_warranty(p_id uuid, p_staff uuid, p_label text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_ew e_warranties%rowtype;
  v_number text;
begin
  select * into v_ew from e_warranties where id = p_id for update;
  if v_ew.id is null then raise exception 'e_warranty_not_found'; end if;
  if v_ew.status <> 'pending_review' then raise exception 'already_decided'; end if;

  v_number := public.next_number('EW');
  update e_warranties set status = 'issued', number = v_number, issued_by = p_staff, issued_at = now()
  where id = p_id;

  perform public.audit_from_json(jsonb_build_object(
    'registration_id', v_ew.registration_id, 'e_warranty_id', p_id, 'entity', 'e_warranty',
    'action', 'issued', 'from_status', 'pending_review', 'to_status', 'issued',
    'actor_staff', p_staff, 'actor_label', p_label, 'data', jsonb_build_object('number', v_number),
    'visible_to_customer', true, 'customer_message', 'Standard e-warranty certificate issued'
  ));
  return v_number;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'audit_from_json(jsonb)', 'submit_registration(jsonb)',
    'transition_registration(uuid, text[], text, jsonb, jsonb)', 'submit_claim(jsonb)',
    'transition_claim(uuid, text[], text, jsonb, jsonb)', 'issue_e_warranty(uuid, uuid, text)',
    'next_number(text)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
