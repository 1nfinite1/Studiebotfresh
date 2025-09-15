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

async function getActiveSet(db, { vak, leerjaar, hoofdstuk }) {
  const s = await db.collection('material_sets').findOne({ vak, leerjaar, hoofdstuk, active: true })
  if (!s) return null
  const { _id, ...rest } = s
  return rest
}

export async function GET(request) {
  try {
    const url = new URL(request.url)
    const vak = url.searchParams.get('vak') || ''
    const leerjaar = url.searchParams.get('leerjaar') || ''
    const hoofdstuk = url.searchParams.get('hoofdstuk') || ''
    const db = await connectToMongo()
    const sets = await getSetsFor(db, { vak, leerjaar, hoofdstuk })
    const setIds = sets.map(s => s.id)
    const setMap = new Map(sets.map(s => [s.id, s]))
    let items = []
    if (setIds.length) {
      const mats = await db.collection('materials').find({ setId: { $in: setIds } }).sort({ createdAt: -1 }).toArray()
      items = mats.map(({ _id, ...rest }) => {
        const setInfo = setMap.get(rest.setId) || {}
        return { ...rest, vak: setInfo.vak, leerjaar: setInfo.leerjaar, hoofdstuk: setInfo.hoofdstuk }
      })
    }
    const activeSet = await getActiveSet(db, { vak, leerjaar, hoofdstuk })
    return jsonOk({ items, set: activeSet })
  } catch (error) {
    console.error('List Error:', error)
    return jsonErr('Internal server error', 500)
  }
}