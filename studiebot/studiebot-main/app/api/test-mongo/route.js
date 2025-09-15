import { NextResponse } from 'next/server'
export const runtime = 'nodejs'

// Disable during build: only responds at runtime, and never attempts to connect
export async function GET() {
  return NextResponse.json({
    note: 'This endpoint is disabled in build context. Use /api/status-db instead for runtime checks.'
  })
}