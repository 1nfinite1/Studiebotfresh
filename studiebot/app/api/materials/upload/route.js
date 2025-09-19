export const runtime = 'nodejs';
import { NextResponse } from 'next/server';

// Simplified debug route: always returns JSON success, no parsing or DB calls
export async function POST() {
  const payload = {
    ok: true,
    message: 'dummy upload success',
  };
  return NextResponse.json(payload, { status: 200 });
}