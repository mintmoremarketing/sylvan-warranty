import Link from "next/link"
import { IconArrowRight, IconMenu2, IconShieldCheck } from "@tabler/icons-react"

import { Brand } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { getAuthUser } from "@/lib/auth"

const NAV = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#covered-products", label: "Covered products" },
  { href: "/#coverage", label: "What's covered" },
  { href: "/#faqs", label: "FAQs" },
  { href: "/policy", label: "Policy" },
]

export async function SiteHeader() {
  const user = await getAuthUser()
  const portalLabel = user ? "My Care+" : "Login"

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Brand />
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {NAV.map((item) => (
            <Button key={item.href} variant="ghost" render={<Link href={item.href} />} nativeButton={false}>
              {item.label}
            </Button>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button className="hidden sm:inline-flex" variant="outline" render={<Link href="/my/register" />} nativeButton={false}>
            <IconShieldCheck data-icon="inline-start" />
            Register warranty
          </Button>
          <Button render={<Link href="/my" />} nativeButton={false}>
            {portalLabel}
            <IconArrowRight data-icon="inline-end" />
          </Button>
          <Sheet>
            <SheetTrigger render={<Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu" />}>
              <IconMenu2 />
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>SylvanCare+</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 px-4" aria-label="Mobile">
                {NAV.map((item) => (
                  <Button key={item.href} variant="ghost" className="h-11 justify-start" render={<Link href={item.href} />} nativeButton={false}>
                    {item.label}
                  </Button>
                ))}
                <Separator className="my-2" />
                <Button className="h-11" render={<Link href="/my/register" />} nativeButton={false}>
                  Register warranty
                </Button>
                <Button variant="outline" className="h-11" render={<Link href="/my" />} nativeButton={false}>
                  Track warranty or complaint
                </Button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
