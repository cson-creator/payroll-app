import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import * as XLSX from 'xlsx'
import { SHIFTKEY_SPECIALTY_MAP } from '@/lib/departments'
import { format, parse } from 'date-fns'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File
  const facilityId = formData.get('facilityId') as string

  if (!file || !facilityId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws)

  // Validate that the ShiftKey file matches the selected facility
  const { data: facility } = await supabaseAdmin
    .from('facilities')
    .select('name')
    .eq('id', facilityId)
    .single()

  if (facility && rows.length > 0) {
    const fileSlug = String(rows[0]['Facility'] || '').toLowerCase()
    const facSlug = facility.name.toLowerCase()
    const keyword = facSlug.split(' ')[0] // 'chandler', 'briarcliff', 'waco'
    if (fileSlug && !fileSlug.includes(keyword)) {
      return NextResponse.json(
        { error: `File appears to be for "${rows[0]['Facility']}" but selected facility is "${facility.name}". Please check your selection.` },
        { status: 400 }
      )
    }
  }

  // Group hours by date + specialty (sum multiple shifts)
  const grouped: Record<string, Record<string, number>> = {}

  for (const row of rows) {
    const rawDate = row['Shift Date']
    const rawSpecialty = String(row['Specialty'] || '').trim()
    const hours = parseFloat(String(row['Hours Worked'] || '0')) || 0

    if (!rawDate || !rawSpecialty || hours <= 0) continue

    // Normalize date to yyyy-MM-dd
    let dateStr: string
    try {
      if (rawDate instanceof Date) {
        dateStr = format(rawDate, 'yyyy-MM-dd')
      } else {
        // Handle MM/DD/YYYY string format
        const parsed = parse(String(rawDate), 'MM/dd/yyyy', new Date())
        dateStr = format(parsed, 'yyyy-MM-dd')
      }
    } catch { continue }

    // Map specialty to canonical name
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
    return NextResponse.json({ error: 'No valid rows found in file' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('daily_shiftkey')
    .upsert(upsertRows, { onConflict: 'facility_id,date,specialty' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, rowsIngested: upsertRows.length })
}