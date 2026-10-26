# Sylvan Guarantee — warranty registration

Next.js 16 + shadcn/ui (Base UI, `b4gNjSxlY` preset) + Supabase. Customers log in with their
mobile number, register a site with one or more invoices and the Sylvan products used, and
track the registration's status and WIN on their dashboard.

## Run it

```bash
npm install
cp .env.example .env.local
npm run dev
```

With the Supabase keys left blank the app runs in **demo mode**: everything works, but uploads
and registrations aren't saved. Login accepts the OTP in `DEMO_OTP` (default `123456`).

## Connect Supabase

1. Create a project and fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` and `SESSION_SECRET` in `.env.local`.
2. Apply `supabase/migrations/20261008000000_warranty_registration.sql` (SQL editor, or
   `supabase db push`). It creates the tables, a private `invoices` storage bucket, seeds the
   product list, and adds the `submit_warranty_registration` function.

All tables are RLS-locked with no policies; only the server (service-role key) reads or writes.
Invoice files go straight from the browser to Storage through signed upload URLs, so large
files never pass through the Next.js server.

## Where things live

| Path | What |
| --- | --- |
| `app/login` | Mobile + OTP login (demo OTP for now) and the signed session cookie |
| `app/warranty-registration` | The registration form, invoice uploads and the submit action |
| `app/dashboard` | The customer's registrations with status and WIN |
| `app/api/pincode/[pin]` | Pincode → state/districts via India Post |
| `lib/registration.ts` | Validation rules shared by the form and the server |
| `lib/catalog.ts` | Product list fallback (the DB `products` table is the source of truth) |

## Before going live

- **Real OTP**: replace `sendOtp` / `verifyOtp` in `app/login/actions.ts` with an SMS provider
  (MSG91, Twilio, or Supabase phone auth), with expiry, attempt limits and rate limiting.
- **Admin review**: approving a registration (setting `status = 'approved'` and a `win`) and
  sending the SMS/certificate is not built yet.
