"use client"

import { useEffect, useState, useTransition } from "react"
import { REGEXP_ONLY_DIGITS } from "input-otp"
import { IconMail } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Spinner } from "@/components/ui/spinner"

const RESEND_SECONDS = 30

type Props = {
  title: string
  description: string
  next?: string
  send: (email: string) => Promise<{ ok: true } | { ok: false; error: string }>
  verify: (email: string, code: string, next?: string) => Promise<{ ok: true } | { ok: false; error: string }>
  footer?: React.ReactNode
}

/** Email + 6-digit code login. On success the verify action redirects. */
export function OtpLoginForm({ title, description, next, send, verify, footer }: Props) {
  const [step, setStep] = useState<"email" | "code">("email")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [resendIn, setResendIn] = useState(0)
  const [pending, start] = useTransition()

  useEffect(() => {
    if (resendIn <= 0) return
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [resendIn])

  function requestCode() {
    setError("")
    start(async () => {
      const res = await send(email)
      if (!res.ok) return setError(res.error)
      setCode("")
      setStep("code")
      setResendIn(RESEND_SECONDS)
    })
  }

  function submitCode(value = code) {
    setError("")
    if (value.length !== 6) return setError("Enter the 6-digit code")
    start(async () => {
      const res = await verify(email, value, next)
      if (res && !res.ok) {
        setError(res.error)
        setCode("")
      }
    })
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">{step === "email" ? title : "Check your email"}</CardTitle>
        <CardDescription>
          {step === "email" ? description : <>We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>.</>}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {step === "email" ? (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              requestCode()
            }}
          >
            <FieldGroup>
              <Field data-invalid={!!error}>
                <FieldLabel htmlFor="login-email">Email address</FieldLabel>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={!!error}
                />
                {error ? <FieldError>{error}</FieldError> : <FieldDescription>We&apos;ll email you a one-time code. No password needed.</FieldDescription>}
              </Field>
              <Button type="submit" size="lg" className="max-sm:h-11" disabled={pending}>
                {pending ? <Spinner data-icon="inline-start" /> : <IconMail data-icon="inline-start" />}
                Send code
              </Button>
              {footer}
            </FieldGroup>
          </form>
        ) : (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              submitCode()
            }}
          >
            <FieldGroup>
              <Field data-invalid={!!error}>
                <FieldLabel htmlFor="login-code">Login code</FieldLabel>
                <InputOTP
                  id="login-code"
                  autoFocus
                  maxLength={6}
                  pattern={REGEXP_ONLY_DIGITS}
                  value={code}
                  onChange={setCode}
                  onComplete={(v: string) => submitCode(v)}
                  disabled={pending}
                  aria-invalid={!!error}
                >
                  <InputOTPGroup className="*:data-[slot=input-otp-slot]:size-11 *:data-[slot=input-otp-slot]:text-lg">
                    {Array.from({ length: 6 }, (_, i) => (
                      <InputOTPSlot key={i} index={i} aria-invalid={!!error} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
                <FieldError>{error}</FieldError>
              </Field>
              <Button type="submit" size="lg" className="max-sm:h-11" disabled={pending}>
                {pending && <Spinner data-icon="inline-start" />}
                Verify and continue
              </Button>
              <div className="flex items-center justify-between text-sm">
                <Button type="button" variant="link" className="px-0" onClick={() => { setStep("email"); setError("") }}>
                  Use a different email
                </Button>
                <Button type="button" variant="link" className="px-0" disabled={resendIn > 0 || pending} onClick={requestCode}>
                  {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
                </Button>
              </div>
            </FieldGroup>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
