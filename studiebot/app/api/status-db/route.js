import { MongoClient } from 'mongodb'
import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const url = process.env.MONGO_URL
    const name = process.env.DB_NAME || 'studiebot'
    if (!url) return NextResponse.json({ ok: false, error: 'MONGO_URL missing' }, { status: 500 })
    const client = new MongoClient(url)
    await client.connect()
    const db = client.db(name)
    const ping = await db.command({ ping: 1 }).catch(() => ({}))
    const serverStatus = { ping: ping?.ok === 1 }
    await client.close()
    return NextResponse.json({ ok: true, db: name, serverStatus })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e?.message || 'connect failed' }, { status: 500 })
  }
}