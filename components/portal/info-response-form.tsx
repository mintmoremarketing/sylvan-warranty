"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { IconAlertCircle, IconSend } from "@tabler/icons-react"

import { respondToInfoRequest } from "@/app/my/registrations/actions"
import { doneFiles, FileUploader, isUploading, type UploadItem } from "@/components/file-uploader"
import { FormField } from "@/components/form-field"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"

export function InfoResponseForm({ requestId, items, remarks }: { requestId: string; items: string[]; remarks: string }) {
  const router = useRouter()
  const [files, setFiles] = useState<UploadItem[]>([])
  const [note, setNote] = useState("")
  const [error, setError] = useState("")
  const [pending, start] = useTransition()

  return (
    <div className="flex flex-col gap-4">
      <Alert variant="destructive">
        <IconAlertCircle />
        <AlertTitle>Action required: {items.join(", ")}</AlertTitle>
        <AlertDescription>{remarks}</AlertDescription>
      </Alert>
      <FieldGroup>
        <FormField label="Upload documents or photos" htmlFor={`info-${requestId}`}>
          <FileUploader id={`info-${requestId}`} kind="info_response" items={files} setItems={(fn) => setFiles(fn)} label="Add files" />
        </FormField>
        <FormField label="Note for our team" htmlFor={`note-${requestId}`} error={error}>
          <Textarea id={`note-${requestId}`} rows={3} value={note} onChange={(e) => setNote(e.target.value)} aria-invalid={!!error} />
        </FormField>
        <Button
          size="lg"
          className="max-sm:h-11 sm:w-fit"
          disabled={pending || isUploading(files)}
          onClick={() =>
            start(async () => {
              setError("")
              const res = await respondToInfoRequest(requestId, note, doneFiles(files))
              if (!res.ok) return setError(res.error)
              toast.success("Thanks — your information has been submitted.")
              router.refresh()
            })
          }
        >
          {pending ? <Spinner data-icon="inline-start" /> : <IconSend data-icon="inline-start" />}
          Submit information
        </Button>
      </FieldGroup>
    </div>
  )
}
