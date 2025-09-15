import { MongoClient } from 'mongodb'
import { NextResponse } from 'next/server'
export const runtime = 'nodejs'

let client
let db

async function connectToMongo() {
  if (!client) {
    const url = process.env.MONGO_URL
    if (!url) throw new Error('MONGO_URL missing')
    client = new MongoClient(url)
    await client.connect()
    const name = process.env.DB_NAME || 'studiebot'
    db = client.db(name)
  }
  return db
}

function handleCORS(response) {
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  return response
}

function jsonOk(data, status = 200) { return handleCORS(NextResponse.json({ data }, { status })) }
function jsonErr(error, status = 400) { return handleCORS(NextResponse.json({ error }, { status })) }

export async function OPTIONS() {
  return handleCORS(new NextResponse(null, { status: 200 }))
}

async function getSetsFor(db, { vak, leerjaar, hoofdstuk }) {
  const sets = await db.collection('material_sets').find({ vak, leerjaar, hoofdstuk }).sort({ createdAt: -1 }).toArray()
  return sets.map(({ _id, ...rest }) => rest)
}

async function activateLatestSet(db, { vak, leerjaar, hoofdstuk }) {
  const sets = await getSetsFor(db, { vak, leerjaar, hoofdstuk })
  if (sets.length === 0) return null
  const latest = sets[0]
  await db.collection('material_sets').updateMany({ vak, leerjaar, hoofdstuk }, { $set: { active: false } })
  await db.collection('material_sets').updateOne({ id: latest.id }, { $set: { active: true, updatedAt: new Date() } })
  return latest
}

export async function PUT(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { vak, leerjaar, hoofdstuk } = body || {}
    if (!vak || !leerjaar || !hoofdstuk) return jsonErr('vak, leerjaar en hoofdstuk zijn verplicht')
    const db = await connectToMongo()
    const latest = await activateLatestSet(db, { vak, leerjaar, hoofdstuk })
    if (!latest) return jsonErr('Geen set gevonden om te activeren', 404)
    return jsonOk({ setId: latest.id, active: true })
  } catch (error) {
    console.error('Activate Error:', error)
    return jsonErr('Internal server error', 500)
  }
}