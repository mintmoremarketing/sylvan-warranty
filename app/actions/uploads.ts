"use server"

import { getAuthUser } from "@/lib/auth"
import { UPLOAD_KINDS, type UploadKind } from "@/lib/domain/registration"
import { createUploadTicket, type UploadTicket } from "@/lib/storage"

/** Issues a signed upload URL for one file. Anyone signed in (customer or staff) may upload. */
export async function prepareUpload(kind: UploadKind, file: { name: string; size: number }): Promise<UploadTicket> {
  const user = await getAuthUser()
  if (!user) return { ok: false, error: "Your session has expired. Please log in again." }
  if (!(kind in UPLOAD_KINDS)) return { ok: false, error: "Unknown upload type" }
  return createUploadTicket(user.id, kind, { name: String(file.name).slice(0, 200), size: Number(file.size) })
}
