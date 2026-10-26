import { randomUUID } from "node:crypto"

import {
  contentTypeFor,
  DOCUMENT_BUCKET,
  UPLOAD_KINDS,
  type FileRef,
  type UploadKind,
} from "@/lib/domain/registration"
import { supabaseAdmin } from "@/lib/supabase/admin"

export type UploadTicket =
  | { ok: true; path: string; token: string; contentType: string }
  | { ok: false; error: string }

/** A signed URL the browser uploads one file to, inside the uploader's own folder. */
export async function createUploadTicket(
  ownerKey: string,
  kind: UploadKind,
  file: { name: string; size: number }
): Promise<UploadTicket> {
  const rules = UPLOAD_KINDS[kind]
  if (!rules) return { ok: false, error: "Unknown upload type" }
  const contentType = contentTypeFor(file.name, kind)
  if (!contentType) return { ok: false, error: `Allowed: ${rules.accept.replaceAll(".", "").toUpperCase()}` }
  if (!(file.size > 0) || file.size > rules.maxBytes)
    return { ok: false, error: `Each file must be under ${rules.maxBytes / 1024 / 1024} MB` }

  const ext = file.name.split(".").pop()!.toLowerCase()
  const path = `uploads/${ownerKey}/${kind}/${randomUUID()}.${ext}`
  const { data, error } = await supabaseAdmin().storage.from(DOCUMENT_BUCKET).createSignedUploadUrl(path)
  if (error || !data) {
    console.error("createSignedUploadUrl", error)
    return { ok: false, error: "Upload failed. Please try again." }
  }
  return { ok: true, path, token: data.token, contentType }
}

/** Files referenced in a submission must have been uploaded by the same person, and must exist. */
export async function verifyUploads(ownerKey: string, files: FileRef[]) {
  const prefix = `uploads/${ownerKey}/`
  if (files.some((f) => !f.path.startsWith(prefix) || f.path.includes(".."))) return false
  if (!files.length) return true
  const folders = [...new Set(files.map((f) => f.path.slice(0, f.path.lastIndexOf("/"))))]
  const found = new Set<string>()
  for (const folder of folders) {
    const { data } = await supabaseAdmin().storage.from(DOCUMENT_BUCKET).list(folder, { limit: 1000 })
    for (const o of data ?? []) found.add(`${folder}/${o.name}`)
  }
  return files.every((f) => found.has(f.path))
}

/** Short-lived download links for private documents. */
export async function signedUrls(paths: string[], expiresIn = 60 * 30): Promise<Record<string, string>> {
  if (!paths.length) return {}
  const { data } = await supabaseAdmin().storage.from(DOCUMENT_BUCKET).createSignedUrls(paths, expiresIn)
  return Object.fromEntries(
    (data ?? []).flatMap((d) => (d.signedUrl && d.path ? [[d.path, d.signedUrl] as const] : []))
  )
}

/** Normalises file references coming from the client. */
export function cleanFiles(raw: unknown, max = 30): FileRef[] {
  if (!Array.isArray(raw)) return []
  return raw.slice(0, max).map((f) => {
    const o = (f ?? {}) as Record<string, unknown>
    return {
      path: String(o.path ?? "").slice(0, 300),
      file_name: String(o.file_name ?? "file").slice(0, 200),
      content_type: String(o.content_type ?? "application/octet-stream").slice(0, 100),
      size_bytes: Math.max(0, Number(o.size_bytes) || 0),
      sha256: typeof o.sha256 === "string" && /^[a-f0-9]{64}$/.test(o.sha256) ? o.sha256 : null,
    }
  })
}
