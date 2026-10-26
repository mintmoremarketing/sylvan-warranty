// SLA deadlines in working hours (the brief's "48 working hours"), in India time.

export type WorkingHours = { days: number[]; start: string; end: string }

const IST_OFFSET_MIN = 330

function istParts(d: Date) {
  const ist = new Date(d.getTime() + IST_OFFSET_MIN * 60_000)
  return { date: ist.toISOString().slice(0, 10), day: ist.getUTCDay(), minutes: ist.getUTCHours() * 60 + ist.getUTCMinutes() }
}

function istMidnightUtc(date: string) {
  return Date.parse(`${date}T00:00:00Z`) - IST_OFFSET_MIN * 60_000
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number)
  return h * 60 + m
}

/** Adds `hours` of working time to `from`, skipping non-working days and holidays. */
export function addWorkingHours(from: Date, hours: number, wh: WorkingHours, holidays: string[] = []) {
  const open = toMinutes(wh.start)
  const close = toMinutes(wh.end)
  let remaining = hours * 60
  let { date, day, minutes } = istParts(from)

  for (let guard = 0; guard < 1000; guard++) {
    const working = wh.days.includes(day) && !holidays.includes(date)
    if (working && minutes < close) {
      const startAt = Math.max(minutes, open)
      const available = close - startAt
      if (remaining <= available) return new Date(istMidnightUtc(date) + (startAt + remaining) * 60_000)
      remaining -= available
    }
    const next = new Date(istMidnightUtc(date) + 36 * 3_600_000)
    ;({ date, day } = istParts(next))
    minutes = 0
  }
  throw new Error("addWorkingHours: no working time found")
}

export function slaState(due: string | null | undefined, now = new Date()) {
  if (!due) return null
  const ms = Date.parse(due) - now.getTime()
  if (ms < 0) return { overdue: true, label: `Overdue by ${humanize(-ms)}` }
  return { overdue: false, label: `Due in ${humanize(ms)}` }
}

function humanize(ms: number) {
  const h = Math.floor(ms / 3_600_000)
  if (h >= 48) return `${Math.floor(h / 24)} days`
  if (h >= 1) return `${h} h`
  return `${Math.max(1, Math.floor(ms / 60_000))} min`
}
