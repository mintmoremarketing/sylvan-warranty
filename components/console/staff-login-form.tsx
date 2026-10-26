"use client"

import { useState, useTransition } from "react"
import { IconLogin2 } from "@tabler/icons-react"

import { staffLogin } from "@/app/console/login/actions"
import { FormField } from "@/components/form-field"
import { PasswordInput } from "@/components/password-input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FieldError, FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"

export function StaffLoginForm({ next }: { next?: string }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [pending, start] = useTransition()

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">Staff login</CardTitle>
        <CardDescription>For Sylvan warranty, customer care, inspection and finance teams.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            setError("")
            start(async () => {
              const res = await staffLogin(email, password, next)
              if (res && !res.ok) setError(res.error)
            })
          }}
        >
          <FieldGroup>
            <FormField label="Work email" htmlFor="staff-email">
              <Input id="staff-email" type="email" autoComplete="username" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
            </FormField>
            <FormField label="Password" htmlFor="staff-password">
              <PasswordInput id="staff-password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </FormField>
            <FieldError>{error}</FieldError>
            <Button type="submit" size="lg" className="max-sm:h-11" disabled={pending}>
              {pending ? <Spinner data-icon="inline-start" /> : <IconLogin2 data-icon="inline-start" />}
              Log in
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
