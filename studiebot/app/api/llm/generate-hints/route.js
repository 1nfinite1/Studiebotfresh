export const runtime = 'nodejs';
import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ ok: false, reason: 'gone', message: 'Deze route is verwijderd.' }, { status: 410 });
}