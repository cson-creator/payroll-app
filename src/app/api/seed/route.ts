import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({ message: 'Seed route disabled — seed via Supabase SQL Editor directly.' }, { status: 410 })
}import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({ message: 'Seed route disabled — seed via Supabase SQL Editor directly.' }, { status: 410 })
}
