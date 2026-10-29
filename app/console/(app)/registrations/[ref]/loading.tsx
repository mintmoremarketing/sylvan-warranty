import { ActionBarSkeleton, CardSkeleton, HeaderSkeleton, LoadingPage, PageBody } from "@/components/console/page-loading"

export default function Loading() {
  return (
    <LoadingPage>
      <HeaderSkeleton back />
      <PageBody>
        <CardSkeleton rows={2} rowClassName="h-10" />
        <CardSkeleton rows={3} rowClassName="h-16" />
        <div className="grid gap-3 sm:gap-5 lg:grid-cols-[1.4fr_1fr]">
          <div className="flex flex-col gap-3 sm:gap-5">
            <CardSkeleton rows={6} />
            <CardSkeleton rows={4} rowClassName="h-10" />
          </div>
          <div className="flex flex-col gap-3 sm:gap-5">
            <CardSkeleton rows={8} />
            <CardSkeleton rows={2} rowClassName="h-10" />
            <CardSkeleton rows={4} />
          </div>
        </div>
        <ActionBarSkeleton buttons={2} />
      </PageBody>
    </LoadingPage>
  )
}
