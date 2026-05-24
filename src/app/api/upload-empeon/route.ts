import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import Papa from 'papaparse'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File
  const facilityId = formData.get('facilityId') as string
  const date = formData.get('date') as string // yyyy-MM-dd, operator-confirmed

  if (!file || !facilityId || !date) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const text = await file.text()

  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: h => h.trim(),
  })

  if (parsed.errors.length > 0) {
    return NextResponse.json({ error: 'CSV parse error', details: parsed.errors }, { status: 400 })
  }

  const rows = parsed.data as Record<string, string>[]

  // Normalize column names — Empeon headers vary slightly
  const upsertRows = rows
    .map(row => {
      // Find the position/department column (first non-numeric header)
      const posKey = Object.keys(row).find(k =>
        k.toLowerCase().includes('position') || k.toLowerCase().includes('desc') || k.toLowerCase().includes('name')
      ) || Object.keys(row)[0]

      const regKey = Object.keys(row).find(k => k.toLowerCase().includes('reg'))
      const otKey = Object.keys(row).find(k => k.toLowerCase().includes('ot') || k.toLowerCase().includes('over'))

      const cc2_name = row[posKey]?.trim()
      const reg_hours = parseFloat(row[regKey || ''] || '0') || 0
      const ot_hours = parseFloat(row[otKey || ''] || '0') || 0

      if (!cc2_name) return null
      return { facility_id: facilityId, date, cc2_name, reg_hours, ot_hours }
    })
    .filter(Boolean)

  const { error } = await supabaseAdmin
    .from('daily_empeon')
    .upsert(upsertRows, { onConflict: 'facility_id,date,cc2_name' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, rowsIngested: upsertRows.length })
}