import { supabase } from './supabase'
import { getCycleForDate, getCycleDates, dowLabel, shortDate } from './cycle'
import { NURSING_ALL } from './departments'
import { ReportData, ReportDay } from '@/types'
import { parseISO, format } from 'date-fns'

export async function buildReportData(facilityId: string): Promise<ReportData> {
  const { cycleStart, cycleEnd, dayNum } = getCycleForDate(new Date())
  const dates = getCycleDates(cycleStart)

  const cycleStartStr = format(cycleStart, 'yyyy-MM-dd')
  const cycleEndStr = format(cycleEnd, 'yyyy-MM-dd')

  // Fetch facility
  const { data: facility } = await supabase
    .from('facilities')
    .select('*')
    .eq('id', facilityId)
    .single()

  // Fetch all empeon rows for this cycle
  const { data: empeonRows } = await supabase
    .from('daily_empeon')
    .select('*')
    .eq('facility_id', facilityId)
    .gte('date', cycleStartStr)
    .lte('date', cycleEndStr)

  // Fetch all shiftkey rows for this cycle
  const { data: shiftkeyRows } = await supabase
    .from('daily_shiftkey')
    .select('*')
    .eq('facility_id', facilityId)
    .gte('date', cycleStartStr)
    .lte('date', cycleEndStr)

  // Fetch all census rows for this cycle
  const { data: censusRows } = await supabase
    .from('daily_census')
    .select('*')
    .eq('facility_id', facilityId)
    .gte('date', cycleStartStr)
    .lte('date', cycleEndStr)

  // Index by date for fast lookup
  const empeonByDate: Record<string, Record<string, { reg: number; ot: number }>> = {}
  for (const row of (empeonRows || [])) {
    if (!empeonByDate[row.date]) empeonByDate[row.date] = {}
    empeonByDate[row.date][row.cc2_name] = {
      reg: Number(row.reg_hours),
      ot: Number(row.ot_hours),
    }
  }

  const shiftkeyByDate: Record<string, Record<string, number>> = {}
  for (const row of (shiftkeyRows || [])) {
    if (!shiftkeyByDate[row.date]) shiftkeyByDate[row.date] = {}
    shiftkeyByDate[row.date][row.specialty] = Number(row.hours)
  }

  const censusByDate: Record<string, number> = {}
  for (const row of (censusRows || [])) {
    censusByDate[row.date] = row.census
  }

  const days: ReportDay[] = dates.map((dateStr, i) => ({
    date: dateStr,
    dayNum: i + 1,
    dow: dowLabel(dateStr),
    census: censusByDate[dateStr] ?? null,
    empeon: empeonByDate[dateStr] ?? {},
    shiftkey: shiftkeyByDate[dateStr] ?? {},
  }))

  return {
    facility,
    cycleStart: cycleStartStr,
    cycleEnd: cycleEndStr,
    currentDay: dayNum,
    days,
  }
}