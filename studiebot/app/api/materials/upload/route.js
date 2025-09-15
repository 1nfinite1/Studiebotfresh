import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

const UPLOAD_RATE_LIMIT = { last: new Map() }

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

async function extractTextWithPdfParse(buffer) {
  const mod = await import('pdf-parse').catch(() => null)
  if (!mod) throw new Error('pdf-parse niet geïnstalleerd')
  const pdfParseFn = mod.default || mod
  const parsed = await pdfParseFn(buffer)
  return cleanText(parsed.text || '')
}

async function extractTextWithPdfjs(buffer) {
  // Use pdfjs-dist in Node without worker
  const mod = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const pdfjsLib = mod && (mod.default || mod)
  if (!pdfjsLib) throw new Error('pdfjs-dist niet beschikbaar')
  
  // Disable worker completely for Node.js environment
  if (pdfjsLib.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = null
    pdfjsLib.GlobalWorkerOptions.workerPort = null
  }
  
  const loadingTask = pdfjsLib.getDocument({ 
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true
  })
  const pdf = await loadingTask.promise
  let out = ''
  for (let pageNum = 1; pageNum <= Math.min(pdf.numPages, 50); pageNum++) {
    const page = await pdf.getPage(pageNum)
    const textContent = await page.getTextContent()
    const pageText = textContent.items.map((it) => it.str).join(' ')
    out += (out ? '\n\n' : '') + pageText
  }
  return cleanText(out)
}

async function extractTextFromPdf(buffer) {
  // Try pdf-parse first, then fallback to pdfjs-dist
  try {
    return await extractTextWithPdfParse(buffer)
  } catch (e1) {
    console.warn('pdf-parse failed, trying pdfjs-dist fallback:', e1?.message || e1)
    try {
      return await extractTextWithPdfjs(buffer)
    } catch (e2) {
      console.error('Both pdf-parse and pdfjs-dist failed', e2)
      throw new Error('Kon PDF niet lezen')
    }
  }
}

async function extractTextFromDocx(buffer) {
  try {
    const mod = await import('mammoth')
    const mammoth = mod.default || mod
    const result = await mammoth.extractRawText({ buffer })
    return cleanText(result.value || '')
  } catch (e) {
    console.error('docx parse error', e)
    throw new Error('Kon DOCX niet lezen')
  }
}

export async function POST(request) {
  try {
    // Basic rate limit per IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
    const now = Date.now()
    const last = UPLOAD_RATE_LIMIT.last.get(ip) || 0
    if (now - last < 3000) return jsonErr('Te snel geüpload. Probeer zo nog eens.', 429)
    UPLOAD_RATE_LIMIT.last.set(ip, now)

    // Validate env
    if (!process.env.MONGO_URL) {
      return jsonErr('Server niet geconfigureerd (MONGO_URL ontbreekt)', 500)
    }

    // Parse form
    const form = await request.formData().catch(() => null)
    if (!form) return jsonErr('Invalid multipart/form-data')
    const file = form.get('file')
    const vak = String(form.get('vak') || '')
    const leerjaar = String(form.get('leerjaar') || '')
    const hoofdstuk = String(form.get('hoofdstuk') || '')
    const uploader = String(form.get('uploader') || 'onbekend')

    if (!file || typeof file === 'string') return jsonErr('Bestand ontbreekt')
    if (!vak || !leerjaar || !hoofdstuk) return jsonErr('vak, leerjaar en hoofdstuk zijn verplicht')
    if (!/\.(pdf|docx)$/i.test(file.name || '')) return jsonErr('Alleen .pdf of .docx toegestaan')
    if ((file.size || 0) > 10 * 1024 * 1024) return jsonErr('Bestand te groot (max 10MB)')

    const buffer = Buffer.from(await file.arrayBuffer())

    // Extract text based on file type
    const isPdf = /\.pdf$/i.test(file.name || '')
    let text = ''
    try {
      text = isPdf ? await extractTextFromPdf(buffer) : await extractTextFromDocx(buffer)
    } catch (e) {
      return jsonErr(e.message || 'Kon bestand niet lezen', 400)
    }

    if (!text || text.length < 20) return jsonErr('Bestand bevat geen leesbare tekst', 400)

    // Segment
    const segments = splitIntoSegments(text, 500, 1500)

    // DB actions with guarded connect
    let db
    try {
      db = await connectToMongo()
    } catch (e) {
      console.error('Mongo connect error', e)
      return jsonErr('Kon geen verbinding maken met de database', 500)
    }

    const set = await ensureNewSet(db, { vak, leerjaar, hoofdstuk })

    const material = {
      id: uuidv4(),
      setId: set.id,
      filename: file.name || (isPdf ? 'upload.pdf' : 'upload.docx'),
      type: isPdf ? 'pdf' : 'docx',
      size: file.size || buffer.length,
      status: 'ready',
      uploader,
      createdAt: new Date(),
    }
    await db.collection('materials').insertOne(material)

    const segDocs = segments.map((t, i) => ({ id: uuidv4(), setId: set.id, materialId: material.id, index: i, text: t, length: t.length }))
    if (segDocs.length) await db.collection('material_segments').insertMany(segDocs)

    const item = { ...material, segmentCount: segDocs.length }
    return jsonOk({ item, segmentCount: segDocs.length })
  } catch (error) {
    console.error('Upload Error:', error)
    return jsonErr('Internal server error', 500)
  }
}