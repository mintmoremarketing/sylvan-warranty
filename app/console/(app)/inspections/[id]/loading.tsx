import { CardSkeleton, HeaderSkeleton, LoadingPage, PageBody } from "@/components/console/page-loading"

export default function Loading() {
  return (
    <LoadingPage>
      <HeaderSkeleton back />
      <PageBody>
        <CardSkeleton rows={4} />
        <CardSkeleton rows={5} rowClassName="h-10" />
        <CardSkeleton rows={4} rowClassName="h-10" />
      </PageBody>
    </LoadingPage>
  )
}
