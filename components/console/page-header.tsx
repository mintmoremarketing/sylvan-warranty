import Link from "next/link"
import { IconChevronLeft } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"

export function PageHeader({
  title,
  description,
  back,
  actions,
  children,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  back?: { href: string; label: string }
  actions?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 px-4 pt-5 sm:px-6 sm:pt-6">
      {back && (
        <Button variant="link" className="h-auto w-fit p-0" render={<Link href={back.href} />} nativeButton={false}>
          <IconChevronLeft data-icon="inline-start" />
          {back.label}
        </Button>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
          {description && <div className="text-sm text-muted-foreground">{description}</div>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  )
}

/** Console page body: full-bleed cards on phones, padded grid above. */
export function PageBody({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex flex-col gap-3 py-4 sm:gap-5 sm:px-6 sm:py-6 ${className}`}>{children}</div>
}

export const CONSOLE_CARD = "max-sm:rounded-none max-sm:ring-0 max-sm:border-y"
