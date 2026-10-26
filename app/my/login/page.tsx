import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"

import { sendLoginCode, verifyLoginCode } from "@/app/my/actions"
import { OtpLoginForm } from "@/components/otp-login-form"
import { getAuthUser, safeRedirectPath } from "@/lib/auth"

export const metadata: Metadata = { title: "Log in" }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams
  if (await getAuthUser()) redirect(safeRedirectPath(next, "/my"))

  return (
    <main className="flex justify-center px-4 py-12 sm:py-20">
      <OtpLoginForm
        title="Log in to My Care+"
        description="Use the home or site owner's email. Your warranties are linked to it."
        next={next}
        send={sendLoginCode}
        verify={verifyLoginCode}
        footer={
          <p className="text-center text-xs text-muted-foreground">
            By continuing you agree to the <Link href="/policy" className="underline underline-offset-4">warranty policy</Link>.
          </p>
        }
      />
    </main>
  )
}
