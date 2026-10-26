"use client"

import { useState } from "react"
import { format } from "date-fns"
import { IconCalendar } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

/** yyyy-mm-dd → local Date (avoids the UTC shift of `new Date("yyyy-mm-dd")`). */
function toDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y, m - 1, d)
}

type DatePickerProps = {
  id?: string
  value: string
  onValueChange: (iso: string) => void
  min?: string
  max?: string
  placeholder?: string
  invalid?: boolean
}

export function DatePicker({
  id,
  value,
  onValueChange,
  min,
  max,
  placeholder = "Pick a date",
  invalid,
}: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const selected = value ? toDate(value) : undefined
  const minDate = min ? toDate(min) : undefined
  const maxDate = max ? toDate(max) : undefined

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            aria-invalid={invalid}
            data-empty={!value}
            className="w-full justify-start font-normal max-sm:h-10 data-[empty=true]:text-muted-foreground"
          />
        }
      >
        <IconCalendar data-icon="inline-start" />
        {selected ? format(selected, "d MMM yyyy") : placeholder}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => {
            if (!date) return
            onValueChange(format(date, "yyyy-MM-dd"))
            setOpen(false)
          }}
          defaultMonth={selected ?? maxDate}
          startMonth={minDate}
          endMonth={maxDate}
          disabled={[
            ...(minDate ? [{ before: minDate }] : []),
            ...(maxDate ? [{ after: maxDate }] : []),
          ]}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}
