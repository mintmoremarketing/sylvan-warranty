import type { Metadata } from "next"
import { IconInfoCircle } from "@tabler/icons-react"

import { confirmAssistedConsent, startAssistedRegistration } from "@/app/console/(app)/assisted/actions"
import { PageBody, PageHeader } from "@/components/console/page-header"
import { RegistrationForm } from "@/components/registration/registration-form"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { requireStaff } from "@/lib/auth"
import { registrationFormData } from "@/lib/registration-page-data"

export const metadata: Metadata = { title: "Assisted registration" }

export default async function AssistedPage() {
  await requireStaff(["customer_care"], "/console/assisted")
  const data = await registrationFormData()
  return (
    <>
      <PageHeader title="Assisted registration" description="Customer Care registers the warranty on the customer's behalf, through the same portal." />
      <PageBody className="mx-auto w-full max-w-3xl">
        <Alert className="max-sm:mx-4 max-sm:w-auto">
          <IconInfoCircle />
          <AlertTitle>Customer consent is mandatory</AlertTitle>
          <AlertDescription>
            When you submit, the customer gets a 6-digit code by email. Ask them to read it out — that records their consent and acceptance of the policy. The warranty is always in the home / site owner&apos;s name.
          </AlertDescription>
        </Alert>
        <RegistrationForm
          mode="assisted"
          defaults={{ email: "" }}
          {...data}
          submit={startAssistedRegistration}
          confirmConsent={confirmAssistedConsent}
          doneBase="/console/registrations/"
        />
      </PageBody>
    </>
  )
}
