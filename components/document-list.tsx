import { IconFileTypePdf, IconMovie, IconPhoto } from "@tabler/icons-react"

import {
  Attachment,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
} from "@/components/ui/attachment"
import { formatBytes } from "@/lib/domain/format"
import type { Doc } from "@/lib/queries"

/** Private files shown as attachments; each opens its short-lived signed link in a new tab. */
export function DocumentList({ docs, empty = "No files" }: { docs: Doc[]; empty?: string }) {
  if (!docs.length) return <p className="text-sm text-muted-foreground">{empty}</p>
  return (
    <AttachmentGroup className="flex-wrap overflow-visible">
      {docs.map((d) => {
        const image = d.content_type.startsWith("image/") && !d.content_type.includes("hei")
        return (
          <Attachment key={d.id} className="w-full sm:w-60">
            <AttachmentMedia variant={image && d.url ? "image" : "icon"}>
              {image && d.url ? (
                // eslint-disable-next-line @next/next/no-img-element -- signed private URL
                <img src={d.url} alt="" />
              ) : d.content_type === "application/pdf" ? (
                <IconFileTypePdf />
              ) : d.content_type.startsWith("video/") ? (
                <IconMovie />
              ) : (
                <IconPhoto />
              )}
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle title={d.file_name}>{d.file_name}</AttachmentTitle>
              <AttachmentDescription>{formatBytes(d.size_bytes)}</AttachmentDescription>
            </AttachmentContent>
            {d.url && <AttachmentTrigger render={<a href={d.url} target="_blank" rel="noreferrer" aria-label={`Open ${d.file_name}`} />} />}
          </Attachment>
        )
      })}
    </AttachmentGroup>
  )
}
