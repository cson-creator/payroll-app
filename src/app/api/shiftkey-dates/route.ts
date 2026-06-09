import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
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

  // Collect unique dates and row counts per date
  const dateCounts: Record<string, number> = {}
  let facilityName = ''

  for (const row of rows) {
    const rawDate = row['Shift Date']
    const hours = parseFloat(String(row['Hours Worked'] || '0')) || 0
    if (!rawDate || hours <= 0) continue

    if (!facilityName && row['Facility']) facilityName = String(row['Facility'])

    let dateStr: string
    try {
      if (rawDate instanceof Date) {
        dateStr = format(rawDate, 'yyyy-MM-dd')
      } else {
        dateStr = format(parse(String(rawDate), 'MM/dd/yyyy', new Date()), 'yyyy-MM-dd')
      }
    } catch { continue }

    dateCounts[dateStr] = (dateCounts[dateStr] || 0) + 1
  }

  const dates = Object.entries(dateCounts)
    .map(([date, rowCount]) => ({ date, rowCount }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return NextResponse.json({ dates, facilityName })
}
