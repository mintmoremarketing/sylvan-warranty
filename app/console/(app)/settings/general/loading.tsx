import { CardSkeleton, HeaderSkeleton, LoadingPage, PageBody } from "@/components/console/page-loading"

export default function Loading() {
  return (
    <LoadingPage>
      <HeaderSkeleton />
      <PageBody>
        <CardSkeleton rows={6} rowClassName="h-10" />
        <CardSkeleton rows={3} rowClassName="h-10" />
      </PageBody>
    </LoadingPage>
  )
}
