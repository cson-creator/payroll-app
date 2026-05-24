import { NextRequest, NextResponse } from 'next/server'
import { buildReportData } from '@/lib/reportData'

export async function GET(req: NextRequest) {
  const facilityId = req.nextUrl.searchParams.get('facilityId')
  if (!facilityId) return NextResponse.json({ error: 'Missing facilityId' }, { status: 400 })

  try {
    const data = await buildReportData(facilityId)
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}