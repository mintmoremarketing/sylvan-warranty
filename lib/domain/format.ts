export function formatMobile(mobile: string | null | undefined) {
  if (!mobile) return "—"
  return `+91 ${mobile.slice(0, 5)} ${mobile.slice(5)}`
}

export function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatINR(amount: number | null | undefined) {
  if (amount == null) return "—"
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(amount)
}

/** "Ramesh Kumar" → "R***** K****", for the public verification page. */
export function maskName(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0] + "*".repeat(Math.max(1, w.length - 1)))
    .join(" ")
}
