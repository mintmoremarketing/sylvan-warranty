// All business dates are Indian dates, whatever timezone the server runs in.

const IST = "Asia/Kolkata"

/** Today's date in India as yyyy-mm-dd. */
export function todayIST(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: IST }).format(now)
}

export function shiftDate(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Whole days from `from` to `to` (both yyyy-mm-dd). */
export function daysBetween(from: string, to: string) {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000
  )
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—"
  const d = typeof value === "string" && value.length === 10 ? new Date(`${value}T00:00:00+05:30`) : new Date(value)
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: IST }).format(d)
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: IST,
  }).format(new Date(value))
}
