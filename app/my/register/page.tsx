import type { Metadata } from "next"

import { submitRegistration } from "@/app/my/register/actions"
import { RegistrationForm } from "@/components/registration/registration-form"
import { Badge } from "@/components/ui/badge"
import { requireCustomer } from "@/lib/auth"
import { registrationFormData } from "@/lib/registration-page-data"

export const metadata: Metadata = { title: "Register your warranty" }

export default async function RegisterPage() {
  const customer = await requireCustomer("/my/register")
  const data = await registrationFormData()

  return (
    <main className="mx-auto max-w-3xl py-6 xs:px-4 sm:py-10">
      <div className="mb-6 flex flex-col items-center gap-2 px-4 text-center xs:px-0 sm:mb-8 sm:gap-3">
        <Badge>Warranty registration</Badge>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-4xl">Register your purchase</h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          One form for SylvanCare+ and your standard Sylvan e-warranty. It takes about 5 minutes — keep your invoice handy.
        </p>
      </div>
      <RegistrationForm
        mode="customer"
        defaults={{ email: customer.email, name: customer.full_name, mobile: customer.mobile }}
        {...data}
        submit={submitRegistration}
        doneBase="/my/registrations/"
      />
    </main>
  )
}
