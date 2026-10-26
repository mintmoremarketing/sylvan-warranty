-- Reference data from the brief. Everything here is editable later in the console.

insert into public.app_settings (key, value) values
  ('working_hours', '{"days": [1, 2, 3, 4, 5, 6], "start": "10:00", "end": "18:00"}'),
  ('sla', '{"registration_hours": 48, "inspection_to_certificate_hours": 48, "claim_screening_hours": 48}'),
  -- manufacture_check: "invoice_date" uses the invoice date as a stand-in for the manufacture date;
  -- "batch_code" asks the customer for the batch / stamp code (pending Sylvan's decision).
  ('care_plus', '{"manufactured_from": "2026-10-01", "window_days": 90, "manufacture_check": "invoice_date"}'),
  ('standard', '{"window_days": 30}'),
  ('policy_versions', '{"care_plus": "SylvanCare+ Warranty Policy v1 (Oct 2026)", "standard": "Sylvan Warranty Terms & Conditions 2026"}');

insert into public.warranty_programs (code, name, kind, window_days, certificate_title, sort) values
  ('CARE_PLUS', 'SylvanCare+', 'care_plus', 90, 'SylvanCare+ Warranty Certificate', 1),
  ('LIFETIME', 'Lifetime Products (Ply / BB)', 'standard', 30, 'E-Warranty Certificate — Lifetime Products (Ply/BB)', 2),
  ('STD_710', '710 Ply/BB · 303 BWP Ply · Blockboards · Flush Doors', 'standard', 30, 'E-Warranty Certificate — 710 Ply/BB | 303 BWP Ply | Blockboards | Flush Doors', 3),
  ('WPC', 'WPC Solid Polymer Board', 'standard', 30, 'WPC Warranty Certificate', 4);

-- Standard periods: "Lifetime" and WPC "30 years" are from the brief; the 710/303/BB/FD range is
-- provisionally 30 years until Sylvan confirms. Lifetime multipliers are pending from Sylvan.
insert into public.products (name, category, standard_program, standard_period, care_plus_years, coverage_note, product_url, sort) values
  ('Z+ Premium Plus', 'plywood', 'LIFETIME', 'Lifetime', null, null, 'https://sylvanply.com/product/sylvan-z-premium-ply', 1),
  ('Z+ Premium', 'plywood', 'LIFETIME', 'Lifetime', 15, null, 'https://sylvanply.com/product/z-premium', 2),
  ('Premium Club', 'plywood', 'LIFETIME', 'Lifetime', 12, null, 'https://sylvanply.com/product/premium-club', 3),
  ('Elite Plus', 'plywood', 'LIFETIME', 'Lifetime', 12, null, 'https://sylvanply.com/product/elite-plus', 4),
  ('Oceanic Premium Club', 'plywood', 'LIFETIME', 'Lifetime', null, null, 'https://sylvanply.com/product/oceanic-premium-club', 5),
  ('Robusta Premium Plus', 'plywood', 'LIFETIME', 'Lifetime', null, null, 'https://sylvanply.com/product/robusta-premium-plus', 6),
  ('Primo Plus', 'plywood', 'STD_710', '30 years', null, null, 'https://sylvanply.com/product/primo-plus', 7),
  ('Robusta Premium', 'plywood', 'STD_710', '30 years', null, null, 'https://sylvanply.com/product/robusta-premium', 8),
  ('BLU BWP', 'plywood', 'STD_710', '30 years', null, 'IS:303 BWP grade — borer protection only', 'https://sylvanply.com/product/blu-marine', 9),
  ('Robusta BWP', 'plywood', 'STD_710', '30 years', null, 'IS:303 BWP grade — borer protection only', 'https://sylvanply.com/product/robusta-bwp', 10),

  ('Z+ Premium Plus', 'blockboard', 'LIFETIME', 'Lifetime', null, 'Borer protection only', null, 21),
  ('Z+ Premium', 'blockboard', 'LIFETIME', 'Lifetime', null, 'Borer protection only', null, 22),
  ('Premium Club', 'blockboard', 'LIFETIME', 'Lifetime', null, 'Borer protection only', null, 23),
  ('Elite Plus', 'blockboard', 'LIFETIME', 'Lifetime', null, 'Borer protection only', null, 24),
  ('Oceanic Premium Club', 'blockboard', 'LIFETIME', 'Lifetime', null, 'Borer protection only', null, 25),
  ('Robusta Premium Plus', 'blockboard', 'LIFETIME', 'Lifetime', null, 'Borer protection only', null, 26),
  ('Primo Plus', 'blockboard', 'STD_710', '30 years', null, 'Borer protection only', null, 27),
  ('Robusta Premium', 'blockboard', 'STD_710', '30 years', null, 'Borer protection only', null, 28),
  ('BLU BWP', 'blockboard', 'STD_710', '30 years', null, 'Borer protection only', null, 29),
  ('Robusta BWP', 'blockboard', 'STD_710', '30 years', null, 'Borer protection only', null, 30),

  ('Gateway Pine', 'flush_door', 'STD_710', '30 years', null, 'Borer protection only', 'https://sylvanply.com/product/gateway-pine', 41),
  ('Gateway Hardwood', 'flush_door', 'STD_710', '30 years', null, 'Borer protection only', 'https://sylvanply.com/product/gateway-hardwood', 42),
  ('Robusta Mix Pine', 'flush_door', 'STD_710', '30 years', null, 'Borer protection only', 'https://sylvanply.com/product/robusta-mix-pine', 43),

  ('Sylvan WPC Solid Polymer Board', 'wpc', 'WPC', '30 years', null, 'Manufacturing defects, moisture & water (indoor), termite and borer', null, 51);

insert into public.reason_codes (code, context, label, requires_remarks, sort) values
  ('product_not_eligible', 'registration_reject', 'Product not eligible under SylvanCare+', false, 1),
  ('outside_timeline', 'registration_reject', 'Registration outside permitted timeline', false, 2),
  ('invalid_invoice', 'registration_reject', 'Invalid / unverifiable invoice', false, 3),
  ('product_mismatch', 'registration_reject', 'Product details do not match invoice', false, 4),
  ('quantity_mismatch', 'registration_reject', 'Quantity mismatch', false, 5),
  ('duplicate', 'registration_reject', 'Duplicate registration', false, 6),
  ('authenticity', 'registration_reject', 'Product authenticity could not be verified', false, 7),
  ('site_inconsistent', 'registration_reject', 'Site / product details inconsistent with registration', false, 8),
  ('info_not_provided', 'registration_reject', 'Required information not provided', false, 9),
  ('inspection_unsupported', 'registration_reject', 'Inspection findings do not support eligibility', false, 10),
  ('verification_refused', 'registration_reject', 'Customer did not permit required verification', false, 11),
  ('other', 'registration_reject', 'Other', true, 99),

  ('documents_verified', 'no_inspection', 'Invoice and details fully verified from documents', false, 1),
  ('low_quantity', 'no_inspection', 'Low quantity — low risk', false, 2),
  ('dealer_confirmed', 'no_inspection', 'Dealer confirmed the supply and site', false, 3),
  ('no_inspection_other', 'no_inspection', 'Other', true, 99),

  ('manufacturing_defect', 'claim_finding', 'Manufacturing defect', false, 1),
  ('covered_failure', 'claim_finding', 'Covered performance failure (termite / borer / fungus decay)', false, 2),
  ('site_related', 'claim_finding', 'Site-related cause', false, 3),
  ('installation', 'claim_finding', 'Installation / workmanship cause', false, 4),
  ('usage_maintenance', 'claim_finding', 'Usage / maintenance cause', false, 5),
  ('authenticity_not_established', 'claim_finding', 'Product authenticity not established', false, 6),
  ('insufficient_evidence', 'claim_finding', 'Insufficient evidence', false, 7),
  ('claim_other', 'claim_finding', 'Other', true, 99);
