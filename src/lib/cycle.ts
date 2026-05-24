import { addDays, differenceInDays, format, parseISO } from 'date-fns'

// Anchor: May 17, 2026 = known cycle start
const ANCHOR = new Date('2026-05-17')

export function getCycleForDate(date: Date = new Date()): {
  cycleStart: Date
  cycleEnd: Date
  dayNum: number  // 1-14
} {
  const daysSinceAnchor = differenceInDays(date, ANCHOR)
  // Handle dates before anchor
  const cycleIndex = daysSinceAnchor >= 0
    ? Math.floor(daysSinceAnchor / 14)
    : Math.floor(daysSinceAnchor / 14) - 1

  const cycleStart = addDays(ANCHOR, cycleIndex * 14)
  const cycleEnd = addDays(cycleStart, 13)
  const dayNum = differenceInDays(date, cycleStart) + 1

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