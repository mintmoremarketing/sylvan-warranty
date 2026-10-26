import Image from "next/image"
import Link from "next/link"

import { cn } from "@/lib/utils"

/** Sylvan logo + the SylvanCare+ wordmark. */
export function Brand({ href = "/", subtitle = "SylvanCare+", className }: { href?: string; subtitle?: string; className?: string }) {
  return (
    <Link href={href} aria-label="SylvanCare+ home" className={cn("flex shrink-0 items-center gap-3", className)}>
      <Image
        src="/sylvan-logo.jpg"
        alt="Sylvan Ply — break nahiin banta"
        width={120}
        height={48}
        priority
        className="h-9 w-auto rounded-md bg-white sm:h-10"
      />
      {subtitle && (
        <span className="hidden border-l pl-3 font-heading text-base font-semibold tracking-tight sm:block">
          {subtitle.endsWith("+") ? (
            <>
              {subtitle.slice(0, -1)}
              <span className="text-primary">+</span>
            </>
          ) : (
            subtitle
          )}
        </span>
      )}
    </Link>
  )
}
