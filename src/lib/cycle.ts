import { addDays, differenceInDays, format, parseISO } from 'date-fns'

// Anchor: May 17, 2026 = known cycle start
// Use T12:00:00 (noon) to avoid UTC midnight timezone boundary issues
const ANCHOR = parseISO('2026-05-17T12:00:00')

export function getCycleForDate(date?: Date | string): {
  cycleStart: Date
  cycleEnd: Date
  dayNum: number
} {
  // Normalize input: string dates parsed as noon to avoid timezone shifts
  let d: Date
  if (!date) {
    // Default: today at noon local time
    const now = new Date()
    d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0)
  } else if (typeof date === 'string') {
    // yyyy-MM-dd string — treat as noon local time
    const [y, m, day] = date.split('-').map(Number)
    d = new Date(y, m - 1, day, 12, 0, 0)
  } else {
    d = date
  }

  const daysSinceAnchor = differenceInDays(d, ANCHOR)
  const cycleIndex = daysSinceAnchor >= 0
    ? Math.floor(daysSinceAnchor / 14)
    : Math.floor(daysSinceAnchor / 14) - 1

  const cycleStart = addDays(ANCHOR, cycleIndex * 14)
  const cycleEnd = addDays(cycleStart, 13)
  const dayNum = differenceInDays(d, cycleStart) + 1

  return { cycleStart, cycleEnd, dayNum }
}

export function getCycleDates(cycleStart: Date): string[] {
  return Array.from({ length: 14 }, (_, i) =>
    format(addDays(cycleStart, i), 'yyyy-MM-dd')
  )
}

export function formatCycleLabel(start: Date, end: Date): string {
  return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`
}

export function dowLabel(dateStr: string): string {
  return format(parseISO(dateStr), 'EEE')
}

export function shortDate(dateStr: string): string {
  return format(parseISO(dateStr), 'M/d')
}
