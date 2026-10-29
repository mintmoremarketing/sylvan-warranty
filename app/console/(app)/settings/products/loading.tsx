import { CardSkeleton, HeaderSkeleton, LoadingPage, PageBody } from "@/components/console/page-loading"

export default function Loading() {
  return (
    <LoadingPage>
      <HeaderSkeleton />
      <PageBody>
        <CardSkeleton rows={4} rowClassName="h-12" />
        <CardSkeleton rows={4} rowClassName="h-12" />
        <CardSkeleton rows={2} rowClassName="h-12" />
      </PageBody>
    </LoadingPage>
  )
}
