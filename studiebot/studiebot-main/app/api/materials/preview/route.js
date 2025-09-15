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

export async function GET(request) {
  try {
    const url = new URL(request.url)
    const id = url.searchParams.get('id')
    if (!id) return jsonErr('id is verplicht')
    const db = await connectToMongo()
    const segs = await db.collection('material_segments').find({ materialId: id }).sort({ index: 1 }).limit(5).toArray()
    const preview = segs.map(s => s.text)
    return jsonOk({ segments: preview })
  } catch (error) {
    console.error('Preview Error:', error)
    return jsonErr('Internal server error', 500)
  }
}