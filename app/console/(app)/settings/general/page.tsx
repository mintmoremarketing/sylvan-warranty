import type { Metadata } from "next"

import { CONSOLE_CARD, PageBody, PageHeader } from "@/components/console/page-header"
import { GeneralForm, HolidayList } from "@/components/console/settings-forms"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requireStaff } from "@/lib/auth"
import { getSettings } from "@/lib/settings"
import { supabaseAdmin } from "@/lib/supabase/admin"

export const metadata: Metadata = { title: "SLA & rules" }

export default async function GeneralSettings() {
  await requireStaff(["admin"], "/console/settings/general")
  const [s, { data: holidays }] = await Promise.all([getSettings(), supabaseAdmin().from("holidays").select("day, name").order("day")])

  return (
    <>
      <PageHeader title="SLA & rules" description="Working hours drive every SLA timer. Registration windows and the manufacture-date rule drive eligibility." />
      <PageBody className="mx-auto w-full max-w-3xl">
        <Card className={CONSOLE_CARD}>
          <CardHeader>
            <CardTitle>Timers and eligibility</CardTitle>
          </CardHeader>
          <CardContent>
            <GeneralForm
              initial={{
                days: s.workingHours.days,
                start: s.workingHours.start,
                end: s.workingHours.end,
                registration_hours: String(s.sla.registration_hours),
                inspection_to_certificate_hours: String(s.sla.inspection_to_certificate_hours),
                claim_screening_hours: String(s.sla.claim_screening_hours),
                care_window_days: String(s.eligibility.carePlus.windowDays),
                standard_window_days: String(s.eligibility.standard.windowDays),
                manufacture_check: s.eligibility.carePlus.manufactureCheck,
              }}
            />
          </CardContent>
        </Card>
        <Card className={CONSOLE_CARD}>
          <CardHeader>
            <CardTitle>Holidays</CardTitle>
            <CardDescription>Excluded from SLA working hours.</CardDescription>
          </CardHeader>
          <CardContent>
            <HolidayList holidays={holidays ?? []} />
          </CardContent>
        </Card>
      </PageBody>
    </>
  )
}
