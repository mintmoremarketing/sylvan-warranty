import { CardSkeleton, HeaderSkeleton, LoadingPage, PageBody, StatTilesSkeleton } from "@/components/console/page-loading"

export default function Loading() {
  return (
    <LoadingPage>
      <HeaderSkeleton />
      <PageBody>
        <StatTilesSkeleton count={5} className="grid grid-cols-2 gap-3 px-4 sm:grid-cols-3 sm:px-0 lg:grid-cols-5" />
        <div className="grid gap-3 sm:gap-5 lg:grid-cols-2">
          <CardSkeleton rows={4} rowClassName="h-12" />
          <CardSkeleton rows={3} rowClassName="h-12" />
          <CardSkeleton rows={1} rowClassName="h-9" />
          <CardSkeleton rows={1} rowClassName="h-9" />
        </div>
      </PageBody>
    </LoadingPage>
  )
}
