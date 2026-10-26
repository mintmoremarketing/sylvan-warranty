"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"
import {
  IconAlertTriangle,
  IconFileTypePdf,
  IconMovie,
  IconPhoto,
  IconRefresh,
  IconUpload,
  IconX,
} from "@tabler/icons-react"

import { prepareUpload } from "@/app/actions/uploads"
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { formatBytes } from "@/lib/domain/format"
import {
  contentTypeFor,
  DOCUMENT_BUCKET,
  UPLOAD_KINDS,
  type FileRef,
  type UploadKind,
} from "@/lib/domain/registration"
import { supabaseBrowser } from "@/lib/supabase/browser"

export type UploadItem = {
  id: string
  name: string
  size: number
  status: "uploading" | "done" | "error"
  path?: string
  contentType?: string
  sha256?: string | null
  previewUrl?: string
  error?: string
}

export const doneFiles = (items: UploadItem[]): FileRef[] =>
  items.flatMap((i) =>
    i.status === "done" && i.path
      ? [{ path: i.path, file_name: i.name, content_type: i.contentType!, size_bytes: i.size, sha256: i.sha256 ?? null }]
      : []
  )

export const isUploading = (items: UploadItem[]) => items.some((i) => i.status === "uploading")

async function sha256(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer())
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("")
}

/** Phone photos are often 5–10 MB; shrink them to 2000px JPEG before upload. */
async function shrinkPhoto(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 1.5 * 1024 * 1024) return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85))
    if (!blob || blob.size >= file.size) return file
    return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" })
  } catch {
    return file
  }
}

type FileUploaderProps = {
  id: string
  kind: UploadKind
  items: UploadItem[]
  setItems: (update: (prev: UploadItem[]) => UploadItem[]) => void
  max?: number
  invalid?: boolean
  label?: string
  hint?: string
  /** Opens the rear camera directly on phones (for inspectors and claim photos). */
  capture?: boolean
}

export function FileUploader({
  id,
  kind,
  items,
  setItems,
  max = 10,
  invalid,
  label,
  hint,
  capture,
}: FileUploaderProps) {
  const rules = UPLOAD_KINDS[kind]
  const inputRef = useRef<HTMLInputElement>(null)
  const files = useRef(new Map<string, File>())
  const full = items.length >= max

  // Free preview object URLs when the uploader goes away.
  const previews = useRef<string[]>([])
  useEffect(() => () => previews.current.forEach((u) => URL.revokeObjectURL(u)), [])

  const patch = (itemId: string, change: Partial<UploadItem>) =>
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, ...change } : i)))

  async function upload(itemId: string, file: File) {
    try {
      const ticket = await prepareUpload(kind, { name: file.name, size: file.size })
      if (!ticket.ok) return patch(itemId, { status: "error", error: ticket.error })
      const { error } = await supabaseBrowser()
        .storage.from(DOCUMENT_BUCKET)
        .uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: ticket.contentType })
      if (error) throw error
      const hash = rules.video ? null : await sha256(file)
      patch(itemId, { status: "done", path: ticket.path, contentType: ticket.contentType, sha256: hash, error: undefined })
    } catch (err) {
      console.error("upload", err)
      patch(itemId, { status: "error", error: "Upload failed. Tap retry." })
    }
  }

  async function add(picked: File[]) {
    const room = max - items.length
    if (picked.length > room) toast.error(`You can add ${room} more file${room === 1 ? "" : "s"} here.`)
    for (const original of picked.slice(0, Math.max(room, 0))) {
      if (!contentTypeFor(original.name, kind)) {
        toast.error(`${original.name}: allowed types are ${rules.accept.replaceAll(".", "").toUpperCase()}`)
        continue
      }
      const file = rules.video ? original : await shrinkPhoto(original)
      if (file.size > rules.maxBytes) {
        toast.error(`${original.name} is larger than ${rules.maxBytes / 1024 / 1024} MB.`)
        continue
      }
      const itemId = crypto.randomUUID()
      const previewUrl = /^image\/(jpeg|png|webp)$/.test(file.type) ? URL.createObjectURL(file) : undefined
      if (previewUrl) previews.current.push(previewUrl)
      files.current.set(itemId, file)
      setItems((prev) => [...prev, { id: itemId, name: file.name, size: file.size, status: "uploading", previewUrl }])
      void upload(itemId, file)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        id={id}
        type="file"
        multiple={max > 1}
        accept={rules.accept}
        capture={capture ? "environment" : undefined}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          void add(Array.from(e.target.files ?? []))
          e.target.value = ""
        }}
      />
      {items.length > 0 && (
        <AttachmentGroup className="flex-wrap overflow-visible">
          {items.map((item) => (
            <Attachment key={item.id} state={item.status} className="w-full sm:w-64">
              <AttachmentMedia variant={item.previewUrl ? "image" : "icon"}>
                {item.status === "uploading" ? (
                  <Spinner />
                ) : item.status === "error" ? (
                  <IconAlertTriangle />
                ) : item.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
                  <img src={item.previewUrl} alt="" />
                ) : item.name.toLowerCase().endsWith(".pdf") ? (
                  <IconFileTypePdf />
                ) : rules.video ? (
                  <IconMovie />
                ) : (
                  <IconPhoto />
                )}
              </AttachmentMedia>
              <AttachmentContent>
                <AttachmentTitle title={item.name}>{item.name}</AttachmentTitle>
                <AttachmentDescription>
                  {item.status === "error" ? item.error : item.status === "uploading" ? "Uploading…" : formatBytes(item.size)}
                </AttachmentDescription>
              </AttachmentContent>
              <AttachmentActions>
                {item.status === "error" && (
                  <AttachmentAction
                    aria-label={`Retry ${item.name}`}
                    onClick={() => {
                      const file = files.current.get(item.id)
                      if (!file) return void toast.error("Please remove this file and add it again.")
                      patch(item.id, { status: "uploading", error: undefined })
                      void upload(item.id, file)
                    }}
                  >
                    <IconRefresh />
                  </AttachmentAction>
                )}
                <AttachmentAction
                  aria-label={`Remove ${item.name}`}
                  disabled={item.status === "uploading"}
                  onClick={() => {
                    files.current.delete(item.id)
                    setItems((prev) => prev.filter((i) => i.id !== item.id))
                  }}
                >
                  <IconX />
                </AttachmentAction>
              </AttachmentActions>
            </Attachment>
          ))}
        </AttachmentGroup>
      )}
      <Button
        type="button"
        variant="outline"
        className="h-auto w-full flex-col gap-1 border-dashed py-5 whitespace-normal aria-invalid:border-destructive"
        aria-invalid={invalid}
        disabled={full}
        onClick={() => inputRef.current?.click()}
      >
        <IconUpload className="size-5!" />
        <span>{full ? "File limit reached" : (label ?? `Add ${rules.label.toLowerCase()}`)}</span>
        <span className="text-xs font-normal text-muted-foreground">
          {hint ?? `${rules.accept.replaceAll(".", "").replaceAll(",", ", ").toUpperCase()} · up to ${rules.maxBytes / 1024 / 1024} MB each · max ${max}`}
        </span>
      </Button>
    </div>
  )
}
