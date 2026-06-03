import { NextRequest, NextResponse } from 'next/server'
import { buildReportData } from '@/lib/reportData'

export async function GET(req: NextRequest) {
  const facilityId = req.nextUrl.searchParams.get('facilityId')
  const reportDate = req.nextUrl.searchParams.get('reportDate')

  if (!facilityId) return NextResponse.json({ error: 'Missing facilityId' }, { status: 400 })
  if (!reportDate) return NextResponse.json({ error: 'Missing reportDate' }, { status: 400 })

  try {
    const data = await buildReportData(facilityId, reportDate)
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
