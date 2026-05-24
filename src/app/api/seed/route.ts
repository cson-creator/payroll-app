import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { ALL_DEPARTMENTS } from '@/lib/departments'

export async function POST() {
  const facilities = [
    { name: 'Chandler Nursing Center',  slug: 'chandler',   cms_id: '455910', passcode: 'chandler123',   email_contacts: [] },
    { name: 'Briarcliff Nursing Center', slug: 'briarcliff', cms_id: '',       passcode: 'briarcliff123', email_contacts: [] },
    { name: 'Waco Nursing Center',       slug: 'waco',       cms_id: '',       passcode: 'waco123',       email_contacts: [] },
  ]

  for (const fac of facilities) {
    const { data: existing } = await supabaseAdmin
      .from('facilities')
      .select('id')
      .eq('slug', fac.slug)
      .single()

    let facilityId = existing?.id

    if (!facilityId) {
      const { data: inserted } = await supabaseAdmin
        .from('facilities')
        .insert(fac)
        .select('id')
        .single()
      facilityId = inserted?.id
    }

    if (!facilityId) continue

    // Insert all departments as included by default
    const deptRows = ALL_DEPARTMENTS.map(d => ({
      facility_id: facilityId,
      cc1_group: d.cc1_group,
      cc2_name: d.cc2_name,
      included: true,
    }))

    await supabaseAdmin
      .from('facility_departments')
      .upsert(deptRows, { onConflict: 'facility_id,cc2_name' })
  }

  return NextResponse.json({ success: true })
}