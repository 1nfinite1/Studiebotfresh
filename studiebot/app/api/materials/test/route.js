import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ message: "Materials test endpoint working" })
}

export async function POST() {
  return NextResponse.json({ message: "Materials POST test endpoint working" })
}