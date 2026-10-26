import Link from "next/link"

import { Brand } from "@/components/brand"
import { PortalUserMenu } from "@/components/portal/portal-user-menu"
import { Button } from "@/components/ui/button"
import { getAuthUser } from "@/lib/auth"

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser()

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4">
          <Brand href={user ? "/my" : "/"} subtitle="My Care+" />
          {user?.email ? (
            <PortalUserMenu email={user.email} />
          ) : (
            <Button variant="ghost" render={<Link href="/" />} nativeButton={false}>
              Back to SylvanCare+
            </Button>
          )}
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <footer className="border-t bg-background">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground">
          <span>© Sylvan Plyboard (India) Ltd.</span>
          <span className="flex gap-4">
            <Link href="/policy" className="hover:text-foreground">Policy</Link>
            <a href="mailto:reach@sylvanply.com" className="hover:text-foreground">reach@sylvanply.com</a>
          </span>
        </div>
      </footer>
    </div>
  )
}
