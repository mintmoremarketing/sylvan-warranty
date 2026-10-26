import Link from "next/link"

import { Brand } from "@/components/brand"
import { CallbackDialog } from "@/components/site/callback-dialog"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

const COVERED = [
  { name: "Z+ Premium", href: "https://sylvanply.com/product/z-premium" },
  { name: "Premium Club", href: "https://sylvanply.com/product/premium-club" },
  { name: "Elite Plus", href: "https://sylvanply.com/product/elite-plus" },
]

export function SiteFooter() {
  return (
    <footer className="border-t bg-background">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-3">
          <Brand />
          <p className="text-sm text-muted-foreground">
            SylvanCare+ is the premium warranty from Sylvan Plyboard (India) Ltd., on top of your standard Sylvan product warranty.
          </p>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <h3 className="font-medium">Covered products</h3>
          {COVERED.map((p) => (
            <a key={p.name} href={p.href} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
              {p.name}
            </a>
          ))}
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <h3 className="font-medium">Warranty</h3>
          <Link href="/my/register" className="text-muted-foreground hover:text-foreground">Register warranty</Link>
          <Link href="/my" className="text-muted-foreground hover:text-foreground">Track warranty or complaint</Link>
          <Link href="/policy" className="text-muted-foreground hover:text-foreground">SylvanCare+ policy</Link>
          <Link href="/policy#standard" className="text-muted-foreground hover:text-foreground">Standard warranty terms</Link>
          <Link href="/#faqs" className="text-muted-foreground hover:text-foreground">FAQs</Link>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <h3 className="font-medium">Customer care</h3>
          <a href="mailto:reach@sylvanply.com" className="text-muted-foreground hover:text-foreground">reach@sylvanply.com</a>
          <a href="https://sylvanply.com/contact" target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">Contact us</a>
          <a href="https://sylvanply.com/privacy-policy" target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">Privacy policy</a>
          <CallbackDialog render={<Button variant="link" className="h-auto justify-start p-0" />}>Request a call back</CallbackDialog>
        </div>
      </div>
      <Separator />
      <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-muted-foreground">
        © {new Date().getFullYear()} Sylvan Plyboard (India) Ltd. All rights reserved.
      </p>
    </footer>
  )
}
