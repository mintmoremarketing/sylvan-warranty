"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { IconPhoneCall } from "@tabler/icons-react"

import { requestCallback } from "@/app/(site)/actions"
import { FormField } from "@/components/form-field"
import { PhoneInput } from "@/components/phone-input"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"

const TOPICS = ["Help with registration", "Warranty status", "Raise or track a complaint", "Something else"]

/** `render` is the trigger element (e.g. a Button) and `children` its label. */
export function CallbackDialog({
  render,
  children,
  defaultTopic,
}: {
  render: React.ReactElement
  children: React.ReactNode
  defaultTopic?: string
}) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: "", mobile: "", email: "", topic: defaultTopic ?? "", message: "" })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [pending, start] = useTransition()
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={render}>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            start(async () => {
              const res = await requestCallback(form)
              if (!res.ok) return setErrors(res.errors)
              toast.success("Thanks — our customer care team will call you back shortly.")
              setOpen(false)
              setForm({ name: "", mobile: "", email: "", topic: defaultTopic ?? "", message: "" })
              setErrors({})
            })
          }}
        >
          <DialogHeader>
            <DialogTitle>Request a call back</DialogTitle>
            <DialogDescription>Leave your number and our customer care team will call you.</DialogDescription>
          </DialogHeader>
          <FieldGroup className="my-5">
            <FormField label="Your name" htmlFor="cb-name" required error={errors.name}>
              <Input id="cb-name" value={form.name} onChange={(e) => set("name", e.target.value)} aria-invalid={!!errors.name} autoComplete="name" />
            </FormField>
            <FormField label="Mobile number" htmlFor="cb-mobile" required error={errors.mobile}>
              <PhoneInput id="cb-mobile" value={form.mobile} onValueChange={(v) => set("mobile", v)} aria-invalid={!!errors.mobile} />
            </FormField>
            <FormField label="Email" htmlFor="cb-email" error={errors.email}>
              <Input id="cb-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} aria-invalid={!!errors.email} autoComplete="email" />
            </FormField>
            <FormField label="What do you need help with?" htmlFor="cb-topic" required error={errors.topic}>
              <Select value={form.topic || null} onValueChange={(v) => set("topic", v ?? "")}>
                <SelectTrigger id="cb-topic" className="w-full" aria-invalid={!!errors.topic}>
                  <SelectValue placeholder="Choose a topic" />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {TOPICS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Message" htmlFor="cb-message">
              <Textarea id="cb-message" rows={3} value={form.message} onChange={(e) => set("message", e.target.value)} />
            </FormField>
            {errors.form && <p className="text-sm text-destructive">{errors.form}</p>}
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" size="lg" disabled={pending} className="max-sm:h-11">
              {pending ? <Spinner data-icon="inline-start" /> : <IconPhoneCall data-icon="inline-start" />}
              Request call back
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
