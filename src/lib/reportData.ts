import { supabase } from './supabase'
import { getCycleForDate, getCycleDates, dowLabel } from './cycle'
import { ReportData, ReportDay } from '@/types'
import { parseISO, format } from 'date-fns'

export async function buildReportData(facilityId: string, reportDate: string): Promise<ReportData> {
  // Use the operator-selected date, not the server clock
  const parsedDate = parseISO(reportDate)
  const { cycleStart, cycleEnd, dayNum } = getCycleForDate(parsedDate)
  const dates = getCycleDates(cycleStart)

  const cycleStartStr = format(cycleStart, 'yyyy-MM-dd')
  const cycleEndStr = format(cycleEnd, 'yyyy-MM-dd')

  // Fetch facility and included departments in parallel
  const [{ data: facility }, { data: includedDepts }] = await Promise.all([
    supabase.from('facilities').select('*').eq('id', facilityId).single(),
    supabase.from('facility_departments').select('cc2_name').eq('facility_id', facilityId).eq('included', true),
  ])

  // Build a set of allowed cc2_names for this facility
  // Any empeon row whose cc2_name is not in this set is excluded from the report
  const allowedDepts = new Set((includedDepts || []).map(d => d.cc2_name))

  // Fetch cycle data
  const [{ data: empeonRows }, { data: shiftkeyRows }, { data: censusRows }] = await Promise.all([
    supabase.from('daily_empeon').select('*').eq('facility_id', facilityId).gte('date', cycleStartStr).lte('date', cycleEndStr),
    supabase.from('daily_shiftkey').select('*').eq('facility_id', facilityId).gte('date', cycleStartStr).lte('date', cycleEndStr),
    supabase.from('daily_census').select('*').eq('facility_id', facilityId).gte('date', cycleStartStr).lte('date', cycleEndStr),
  ])

  // Index empeon by date — only include departments toggled on in Admin
  const empeonByDate: Record<string, Record<string, { reg: number; ot: number }>> = {}
  for (const row of (empeonRows || [])) {
    if (!allowedDepts.has(row.cc2_name)) continue  // excluded in Admin → skip entirely
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
