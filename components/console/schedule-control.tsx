"use client"

import { useState } from "react"
import { IconCalendarEvent } from "@tabler/icons-react"

import { scheduleInspection } from "@/app/console/(app)/inspections/actions"
import { ActionDrawer } from "@/components/console/action-drawer"
import { FormField } from "@/components/form-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function ScheduleControl({ id, scheduled }: { id: string; scheduled: boolean }) {
  const [when, setWhen] = useState("")
  return (
    <ActionDrawer
      trigger={<Button variant={scheduled ? "outline" : "default"} className="h-10" />}
      label={
        <>
          <IconCalendarEvent data-icon="inline-start" />
          {scheduled ? "Reschedule visit" : "Schedule visit"}
        </>
      }
      title="Schedule the site visit"
      description="Agree a time with the customer first. They'll get an email confirmation."
      submitLabel="Save and notify customer"
      success="Visit scheduled"
      run={async () => (when ? scheduleInspection(id, new Date(when).toISOString()) : { ok: false, error: "Choose a date and time." })}
    >
      <FormField label="Date and time" htmlFor={`when-${id}`} required>
        <Input id={`when-${id}`} type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
      </FormField>
    </ActionDrawer>
  )
}
