import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import * as XLSX from 'xlsx'
import { SHIFTKEY_SPECIALTY_MAP } from '@/lib/departments'
import { format, parse } from 'date-fns'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File
  const facilityId = formData.get('facilityId') as string
  const selectedDatesRaw = formData.get('selectedDates') as string // JSON array of yyyy-MM-dd strings

  if (!file || !facilityId || !selectedDatesRaw) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  let selectedDates: string[]
  try {
    selectedDates = JSON.parse(selectedDatesRaw)
    if (!Array.isArray(selectedDates) || selectedDates.length === 0) throw new Error()
  } catch {
    return NextResponse.json({ error: 'Invalid selectedDates' }, { status: 400 })
  }

  const allowedSet = new Set(selectedDates)

  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws)

  // Validate facility match
  const { data: facility } = await supabaseAdmin
    .from('facilities').select('name').eq('id', facilityId).single()

  if (facility && rows.length > 0) {
    const fileSlug = String(rows[0]['Facility'] || '').toLowerCase()
    const keyword = facility.name.toLowerCase().split(' ')[0]
    if (fileSlug && !fileSlug.includes(keyword)) {
      return NextResponse.json(
        { error: `File is for "${rows[0]['Facility']}" but selected facility is "${facility.name}".` },
        { status: 400 }
      )
    }
  }

  // Group by date + specialty, only for selected dates
  const grouped: Record<string, Record<string, number>> = {}

  for (const row of rows) {
    const rawDate = row['Shift Date']
    const rawSpecialty = String(row['Specialty'] || '').trim()
    const hours = parseFloat(String(row['Hours Worked'] || '0')) || 0
    if (!rawDate || !rawSpecialty || hours <= 0) continue

    let dateStr: string
    try {
      if (rawDate instanceof Date) {
        dateStr = format(rawDate, 'yyyy-MM-dd')
      } else {
        dateStr = format(parse(String(rawDate), 'MM/dd/yyyy', new Date()), 'yyyy-MM-dd')
      }
    } catch { continue }

    if (!allowedSet.has(dateStr)) continue

    const specialty = SHIFTKEY_SPECIALTY_MAP[rawSpecialty] || rawSpecialty
    if (!grouped[dateStr]) grouped[dateStr] = {}
    grouped[dateStr][specialty] = (grouped[dateStr][specialty] || 0) + hours
  }

  const upsertRows = Object.entries(grouped).flatMap(([date, specs]) =>
    Object.entries(specs).map(([specialty, hours]) => ({
      facility_id: facilityId,
      date,
      specialty,
      hours,
    }))
  )

  if (upsertRows.length === 0) {
    return NextResponse.json({ error: 'No matching rows found for selected dates.' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('daily_shiftkey')
    .upsert(upsertRows, { onConflict: 'facility_id,date,specialty' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const datesSaved = [...new Set(upsertRows.map(r => r.date))].sort()
  return NextResponse.json({ success: true, rowsIngested: upsertRows.length, datesSaved })
}
