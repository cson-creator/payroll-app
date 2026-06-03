import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({ message: 'Seed route disabled.' }, { status: 410 })
}
