import { IconExternalLink } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"

/** The certificate as it will be issued, shown before the issue/approve button is pressed. */
export function CertificatePreview({ src }: { src: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-lg border bg-muted">
        <iframe src={src} title="Certificate preview" className="h-[55svh] w-full" />
      </div>
      {/* Some phone browsers don't show PDFs inside a page. */}
      <Button variant="link" className="h-auto w-fit p-0" render={<a href={src} target="_blank" rel="noreferrer" />} nativeButton={false}>
        <IconExternalLink data-icon="inline-start" />
        Open the preview in a new tab
      </Button>
    </div>
  )
}
