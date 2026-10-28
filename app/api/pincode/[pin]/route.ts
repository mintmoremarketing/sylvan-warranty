import { lookupPincode } from "@/lib/pincode"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ pin: string }> }
) {
  const { pin } = await params
  try {
    const info = await lookupPincode(pin)
    if (!info) return Response.json({ error: "Pincode not found" }, { status: 404 })
    // Pincodes don't change: let the CDN answer repeat lookups.
    return Response.json(info, { headers: { "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=86400" } })
  } catch (error) {
    console.error("pincode lookup", error)
    return Response.json(
      { error: "Pincode service is unavailable. Try again shortly." },
      { status: 503 }
    )
  }
}
