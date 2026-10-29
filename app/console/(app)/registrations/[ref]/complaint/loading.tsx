import { CardSkeleton, HeaderSkeleton, LoadingPage, PageBody } from "@/components/console/page-loading"

export default function Loading() {
  return (
    <LoadingPage>
      <HeaderSkeleton back />
      <PageBody>
        <CardSkeleton rows={3} />
        <CardSkeleton rows={6} rowClassName="h-10" />
      </PageBody>
    </LoadingPage>
  )
}
