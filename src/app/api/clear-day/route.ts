import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: NextRequest) {
  const { facilityId, date, clearCensus } = await req.json()

  if (!facilityId || !date) {
    return NextResponse.json({ error: 'Missing facilityId or date' }, { status: 400 })
  }

  const errors: string[] = []

  // Always clear Empeon and ShiftKey rows for this date
  const { error: empeonErr } = await supabaseAdmin
    .from('daily_empeon')
    .delete()
    .eq('facility_id', facilityId)
    .eq('date', date)

  if (empeonErr) errors.push(`Empeon: ${empeonErr.message}`)

  const { error: shiftkeyErr } = await supabaseAdmin
    .from('daily_shiftkey')
    .delete()
    .eq('facility_id', facilityId)
    .eq('date', date)

  if (shiftkeyErr) errors.push(`ShiftKey: ${shiftkeyErr.message}`)

  // Optionally also clear census
  if (clearCensus) {
    const { error: censusErr } = await supabaseAdmin
      .from('daily_census')
      .delete()
      .eq('facility_id', facilityId)
      .eq('date', date)

    if (censusErr) errors.push(`Census: ${censusErr.message}`)
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
