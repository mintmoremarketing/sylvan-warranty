import { CONSOLE_CARD, PageBody } from "@/components/console/page-header"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

/*
 * Loading screens shown the moment a console link is clicked, shaped like the page that is coming, so the
 * layout doesn't jump when the data arrives. Each route's loading.tsx composes these pieces.
 */

export function LoadingPage({ children }: { children: React.ReactNode }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      {children}
    </div>
  )
}

/** Page title, description and optionally the back link, queue tabs and search box. */
export function HeaderSkeleton({ back, tabs = 0, search }: { back?: boolean; tabs?: number; search?: boolean }) {
  return (
    <div className="flex flex-col gap-3 px-4 pt-5 sm:px-6 sm:pt-6">
      {back && <Skeleton className="h-5 w-28" />}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-56 sm:h-8" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      {search && <Skeleton className="h-9 w-full rounded-4xl" />}
      {tabs > 0 && (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: tabs }, (_, i) => (
            <Skeleton key={i} className="h-8 rounded-4xl" style={{ width: `${56 + ((i * 23) % 40)}px` }} />
          ))}
        </div>
      )}
    </div>
  )
}

/** A card with a title, a description and some lines or blocks of content. */
export function CardSkeleton({ rows = 3, rowClassName = "h-4", title = true }: { rows?: number; rowClassName?: string; title?: boolean }) {
  return (
    <Card className={CONSOLE_CARD}>
      {title && (
        <CardHeader className="gap-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </CardHeader>
      )}
      <CardContent className="flex flex-col gap-3">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className={`${rowClassName} ${i % 3 === 2 ? "w-2/3" : "w-full"}`} />
        ))}
      </CardContent>
    </Card>
  )
}

/** Queue rows: cards on phones, a table on desktop when `columns` is given. */
export function ListSkeleton({ rows = 6, columns }: { rows?: number; columns?: number }) {
  return (
    <Card className={CONSOLE_CARD}>
      <CardContent>
        <div className={`flex flex-col gap-2 ${columns ? "md:hidden" : ""}`}>
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex items-start justify-between gap-3 rounded-lg border p-3">
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3.5 w-full max-w-72" />
                <Skeleton className="h-5 w-24 rounded-4xl" />
              </div>
              <Skeleton className="h-3.5 w-16" />
            </div>
          ))}
        </div>
        {columns && (
          <div className="hidden md:block">
            <div className="flex gap-4 border-b pb-3">
              {Array.from({ length: columns }, (_, c) => (
                <Skeleton key={c} className="h-4 flex-1" />
              ))}
            </div>
            {Array.from({ length: rows }, (_, i) => (
              <div key={i} className="flex items-center gap-4 border-b py-4 last:border-0">
                {Array.from({ length: columns }, (_, c) => (
                  <div key={c} className="flex flex-1 flex-col gap-1.5">
                    <Skeleton className={c === 0 ? "h-4 w-32" : "h-4 w-4/5"} />
                    {c === 1 && <Skeleton className="h-3 w-3/5" />}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/** The row of number tiles on the dashboard and reports. */
export function StatTilesSkeleton({ count, className }: { count: number; className: string }) {
  return (
    <div className={className}>
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} size="sm">
          <CardHeader className="gap-2">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-7 w-12" />
          </CardHeader>
        </Card>
      ))}
    </div>
  )
}

/** The sticky decision bar at the bottom of review pages. */
export function ActionBarSkeleton({ buttons = 3 }: { buttons?: number }) {
  return (
    <div className="flex flex-wrap gap-2 border-t bg-background p-3 sm:rounded-xl sm:border sm:p-4">
      {Array.from({ length: buttons }, (_, i) => (
        <Skeleton key={i} className="h-10 w-28" />
      ))}
    </div>
  )
}

/** A queue page: header with tabs and search, then the list. */
export function QueueLoading({ tabs, columns }: { tabs: number; columns?: number }) {
  return (
    <LoadingPage>
      <HeaderSkeleton tabs={tabs} search />
      <PageBody>
        <ListSkeleton columns={columns} />
      </PageBody>
    </LoadingPage>
  )
}

export { PageBody }
