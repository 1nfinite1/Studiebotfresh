import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
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
export async function OPTIONS() { return handleCORS(new NextResponse(null, { status: 200 })) }

function cleanText(t = '') {
  return String(t || '')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\u00A0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function splitIntoSegments(text, minLen = 500, maxLen = 1500) {
  const out = []
  const paras = text.split(/\n\n+/).map(p => p.trim()).filter(Boolean)
  let buf = ''
  const pushBuf = () => { if (buf.trim()) { out.push(buf.trim()); buf = '' } }
  const tryAdd = (chunk) => {
    if ((buf + (buf ? '\n\n' : '') + chunk).length <= maxLen) {
      buf = buf ? buf + '\n\n' + chunk : chunk
    } else {
      if (buf.length >= minLen) { pushBuf(); buf = chunk }
      else {
        const sentences = chunk.split(/(?<=[.!?])\s+/)
        for (const s of sentences) {
          if ((buf + (buf ? ' ' : '') + s).length <= maxLen) {
            buf = buf ? buf + ' ' + s : s
          } else { pushBuf(); buf = s }
        }
      }
    }
  }
  for (const p of paras) { tryAdd(p) }
  pushBuf()
  const merged = []
  for (const seg of out) {
    if (merged.length > 0 && seg.length < minLen && (merged[merged.length - 1].length + 1 + seg.length) <= maxLen) {
      merged[merged.length - 1] = merged[merged.length - 1] + '\n' + seg
    } else { merged.push(seg) }
  }
  return merged
}

async function ensureNewSet(db, { vak, leerjaar, hoofdstuk }) {
  const set = { id: uuidv4(), vak, leerjaar, hoofdstuk, active: false, createdAt: new Date(), updatedAt: new Date() }
  await db.collection('material_sets').insertOne(set)
  return set
}

export async function POST(request) {
  try {
    if (!process.env.MONGO_URL) {
      return jsonErr('Server niet geconfigureerd (MONGO_URL ontbreekt)', 500)
    }

    const body = await request.json().catch(() => null)
    if (!body) return jsonErr('Invalid JSON body')
    const vak = String(body.vak || '')
    const leerjaar = String(body.leerjaar || '')
    const hoofdstuk = String(body.hoofdstuk || '')
    let text = String(body.text || '')

    if (!vak || !leerjaar || !hoofdstuk) return jsonErr('vak, leerjaar en hoofdstuk zijn verplicht')
    text = cleanText(text)
    if (!text || text.length < 20) return jsonErr('Tekst is te kort of ontbreekt')
    if (text.length > 500_000) return jsonErr('Tekst is te lang (max 500k tekens)')

    const segments = splitIntoSegments(text, 500, 1500)

    let db
    try { db = await connectToMongo() } catch (e) { console.error('Mongo connect error', e); return jsonErr('Kon geen verbinding maken met de database', 500) }

    const set = await ensureNewSet(db, { vak, leerjaar, hoofdstuk })

    const material = {
      id: uuidv4(),
      setId: set.id,
      filename: 'seed.txt',
      type: 'seed-text',
      size: Buffer.byteLength(text, 'utf8'),
      status: 'ready',
      uploader: 'seed',
      createdAt: new Date(),
    }
    await db.collection('materials').insertOne(material)

    const segDocs = segments.map((t, i) => ({ id: uuidv4(), setId: set.id, materialId: material.id, index: i, text: t, length: t.length }))
    if (segDocs.length) await db.collection('material_segments').insertMany(segDocs)

    const item = { ...material, segmentCount: segDocs.length }
    return jsonOk({ item, segmentCount: segDocs.length })
  } catch (error) {
    console.error('Seed-text Error:', error)
    return jsonErr('Internal server error', 500)
  }
}