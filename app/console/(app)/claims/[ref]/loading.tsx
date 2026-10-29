import { ActionBarSkeleton, CardSkeleton, HeaderSkeleton, LoadingPage, PageBody } from "@/components/console/page-loading"

export default function Loading() {
  return (
    <LoadingPage>
      <HeaderSkeleton back />
      <PageBody>
        <div className="grid gap-3 sm:gap-5 lg:grid-cols-[1.3fr_1fr]">
          <div className="flex flex-col gap-3 sm:gap-5">
            <CardSkeleton rows={6} />
            <CardSkeleton rows={4} rowClassName="h-10" />
            <CardSkeleton rows={3} />
          </div>
          <div className="flex flex-col gap-3 sm:gap-5">
            <CardSkeleton rows={5} />
            <CardSkeleton rows={3} />
            <CardSkeleton rows={4} />
          </div>
        </div>
        <ActionBarSkeleton buttons={2} />
      </PageBody>
    </LoadingPage>
  )
}
