import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import * as XLSX from 'xlsx'
import { SHIFTKEY_SPECIALTY_MAP } from '@/lib/departments'
import { format, parse } from 'date-fns'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File
  const facilityId = formData.get('facilityId') as string
  const uploadDate = formData.get('date') as string // yyyy-MM-dd, required — only rows matching this date are stored

  if (!file || !facilityId || !uploadDate) {
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

  // Group hours by specialty — only rows matching uploadDate are accepted
  const grouped: Record<string, number> = {}
  let skippedRows = 0

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
        const parsed = parse(String(rawDate), 'MM/dd/yyyy', new Date())
        dateStr = format(parsed, 'yyyy-MM-dd')
      }
    } catch { continue }

    // Only store rows for the operator-selected date — skip everything else
    if (dateStr !== uploadDate) {
      skippedRows++
      continue
    }

    // Map specialty to canonical name
    const specialty = SHIFTKEY_SPECIALTY_MAP[rawSpecialty] || rawSpecialty
    grouped[specialty] = (grouped[specialty] || 0) + hours
  }

  if (Object.keys(grouped).length === 0) {
    const msg = skippedRows > 0
      ? `No rows found for ${uploadDate}. The file contained ${skippedRows} row(s) for other dates. Check that your selected date matches the ShiftKey export.`
      : 'No valid rows found in file.'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const upsertRows = Object.entries(grouped).map(([specialty, hours]) => ({
    facility_id: facilityId,
    date: uploadDate,
    specialty,
    hours,
  }))

  const { error } = await supabaseAdmin
    .from('daily_shiftkey')
    .upsert(upsertRows, { onConflict: 'facility_id,date,specialty' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const skippedNote = skippedRows > 0 ? ` (${skippedRows} rows from other dates ignored)` : ''
  return NextResponse.json({ success: true, rowsIngested: upsertRows.length, note: skippedNote })
}
