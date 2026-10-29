import { CardSkeleton, HeaderSkeleton, LoadingPage, PageBody, StatTilesSkeleton } from "@/components/console/page-loading"

export default function Loading() {
  return (
    <LoadingPage>
      <HeaderSkeleton />
      <PageBody>
        <StatTilesSkeleton count={7} className="grid grid-cols-2 gap-3 px-4 sm:grid-cols-4 sm:px-0 xl:grid-cols-7" />
        <CardSkeleton rows={1} rowClassName="h-9" />
        <div className="grid gap-3 sm:gap-5 lg:grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => (
            <CardSkeleton key={i} rows={1} rowClassName="h-56" />
          ))}
        </div>
      </PageBody>
    </LoadingPage>
  )
}
