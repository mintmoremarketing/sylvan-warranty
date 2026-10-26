import { PINCODE_RE } from "@/lib/domain/registration"

export type PincodeInfo = { state: string; districts: string[] }

type PostOffice = { District: string; State: string }
type IndiaPostResponse = { Status: string; PostOffice: PostOffice[] | null }[]

/**
 * Looks a pincode up on India Post's public API.
 * Returns null for an unknown pincode and throws if the service is unreachable.
 */
export async function lookupPincode(pin: string): Promise<PincodeInfo | null> {
  if (!PINCODE_RE.test(pin)) return null
  const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`, {
    next: { revalidate: 60 * 60 * 24 * 7 },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`India Post lookup failed: ${res.status}`)
  const [body] = (await res.json()) as IndiaPostResponse
  const offices = body?.Status === "Success" ? (body.PostOffice ?? []) : []
  if (!offices.length) return null
  return {
    state: offices[0].State.toUpperCase(),
    districts: [...new Set(offices.map((o) => o.District.toUpperCase()))].sort(),
  }
}
