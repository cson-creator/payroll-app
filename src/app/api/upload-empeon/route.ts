import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import Papa from 'papaparse'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File
  const facilityId = formData.get('facilityId') as string
  const date = formData.get('date') as string

  if (!file || !facilityId || !date) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const text = await file.text()

  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  })

  if (parsed.errors.length > 0) {
    return NextResponse.json({ error: 'CSV parse error', details: parsed.errors }, { status: 400 })
  }

  const rows = parsed.data as Record<string, string>[]

  // Build upsert rows, stripping numeric prefix from position names
  const upsertRows = rows
    .map(row => {
      const posKey = Object.keys(row).find(k =>
        k.toLowerCase().includes('position') || k.toLowerCase().includes('desc') || k.toLowerCase().includes('name')
      ) || Object.keys(row)[0]

      const regKey = Object.keys(row).find(k => k.toLowerCase().includes('reg'))
      const otKey = Object.keys(row).find(k => k.toLowerCase().includes('ot') || k.toLowerCase().includes('over'))

      // Strip leading numeric code — "630-LVN" → "LVN"
      const cc2_name = row[posKey]?.trim().replace(/^\d+-/, '')
      const reg_hours = parseFloat(row[regKey || ''] || '0') || 0
      const ot_hours = parseFloat(row[otKey || ''] || '0') || 0

      if (!cc2_name) return null
      return { facility_id: facilityId, date, cc2_name, reg_hours, ot_hours }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)

  // Check which positions are not configured for this facility
  const { data: knownDepts } = await supabaseAdmin
    .from('facility_departments')
    .select('cc2_name')
    .eq('facility_id', facilityId)

  const knownNames = new Set((knownDepts || []).map(d => d.cc2_name))
  const unknownPositions = [...new Set(
    upsertRows
      .map(r => r.cc2_name)
      .filter(name => !knownNames.has(name))
  )]

  // Upsert all rows regardless — unknown ones are stored but won't affect report calculations
  const { error } = await supabaseAdmin
    .from('daily_empeon')
    .upsert(upsertRows, { onConflict: 'facility_id,date,cc2_name' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    success: true,
    rowsIngested: upsertRows.length,
    unknownPositions, // empty array if all positions are known
  })
}
