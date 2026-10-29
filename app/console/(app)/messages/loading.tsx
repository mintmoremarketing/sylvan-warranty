import { HeaderSkeleton, ListSkeleton, LoadingPage, PageBody } from "@/components/console/page-loading"

export default function Loading() {
  return (
    <LoadingPage>
      <HeaderSkeleton />
      <PageBody>
        <ListSkeleton rows={8} />
      </PageBody>
    </LoadingPage>
  )
}
