import { NextResponse } from 'next/server'

export async function GET() {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || ''
  return NextResponse.json({ backendUrl }, { status: 200 })
}