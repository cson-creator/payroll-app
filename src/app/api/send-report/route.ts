import { NextRequest, NextResponse } from 'next/server'
import sgMail from '@sendgrid/mail'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { format } from 'date-fns'

sgMail.setApiKey(process.env.SENDGRID_API_KEY!)

export async function POST(req: NextRequest) {
  const { facilityId, pdfBase64, reportDate } = await req.json()

  const { data: facility } = await supabaseAdmin
    .from('facilities')
    .select('*')
    .eq('id', facilityId)
    .single()

  if (!facility) return NextResponse.json({ error: 'Facility not found' }, { status: 404 })
  if (!facility.email_contacts?.length) {
    return NextResponse.json({ error: 'No email contacts configured for this facility' }, { status: 400 })
  }

  const dateLabel = format(new Date(reportDate), 'MMMM d, yyyy')
  const filename = `${facility.name.replace(/\s+/g, '_')}_Payroll_${format(new Date(reportDate), 'yyyy-MM-dd')}.pdf`

  const msg = {
    to: facility.email_contacts,
    from: process.env.SENDGRID_FROM_EMAIL!,
    subject: `${facility.name} — Payroll Report · ${dateLabel}`,
    text: `Please find attached the payroll report for ${facility.name} for ${dateLabel}.`,
    html: `<p>Please find attached the payroll report for <strong>${facility.name}</strong> for ${dateLabel}.</p>`,
    attachments: [
      {
        content: pdfBase64,
        filename,
        type: 'application/pdf',
        disposition: 'attachment',
      },
    ],
  }

  try {
    await sgMail.send(msg)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.response?.body || err.message }, { status: 500 })
  }
}