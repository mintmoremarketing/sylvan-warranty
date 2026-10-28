import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { StaffLoginForm } from "@/components/console/staff-login-form"
import { Brand } from "@/components/brand"
import { getStaff, safeRedirectPath } from "@/lib/auth"

export const metadata: Metadata = { title: "Console login" }

export default async function ConsoleLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams
  if (await getStaff()) redirect(safeRedirectPath(next, "/console"))

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-8 px-4 py-12">
      <Brand href="/" subtitle="SylvanCare+ Console" />
      <StaffLoginForm next={next} />
      {process.env.NODE_ENV !== "production" || process.env.SHOW_DEMO_LOGINS === "true" ? (
        <p className="max-w-sm text-center text-xs text-muted-foreground">
          Demo accounts: admin@, verifier@, approver@, inspector@, coordinator@, technical@, finance@, management@, care@ (all @example.com) — password Sylvan@2026
        </p>
      ) : null}
    </main>
  )
}
