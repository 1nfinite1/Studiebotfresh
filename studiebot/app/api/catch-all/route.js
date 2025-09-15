import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { NextResponse } from 'next/server'
import pdfParse from 'pdf-parse'
export const runtime = 'nodejs'

let client
let db

async function connectToMongo() {
  if (!client) {
    client = new MongoClient(process.env.MONGO_URL)
    await client.connect()
    db = client.db(process.env.DB_NAME)
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

function pick(arr = []) { return arr[Math.floor(Math.random() * arr.length)] }
const SUBJECT_TOPICS = {
  Nederlands: ['samenvatten', 'argumentatie', 'leesdoelen', 'stijlfiguren', 'signaalwoorden'],
  Engels: ['past simple', 'present perfect', 'comparatives', 'articles', 'prepositions'],
  Geschiedenis: ['Middeleeuwen', 'Gouden Eeuw', 'Industriële revolutie', 'WO I', 'WO II'],
  Aardrijkskunde: ['klimaat', 'bevolking', 'globalisering', 'landschappen', 'bodem'],
  Wiskunde: ['breuken', 'procenten', 'vergelijkingen', 'grafieken', 'lineaire functies'],
  Natuurkunde: ['snelheid', 'kracht', 'energie', 'druk', 'elektriciteit'],
  Scheikunde: ['atoombouw', 'reacties', 'zuren en basen', 'mengsels', 'periodiek systeem'],
  Biologie: ['cel', 'ademhaling', 'bloedsomloop', 'ecosystemen', 'erfelijkheid'],
  Economie: ['vraag en aanbod', 'markt', 'inflatie', 'bbp', 'arbeidsmarkt'],
  Maatschappijleer: ['politiek', 'rechtstaat', 'media', 'cultuur', 'socialisatie'],
}

// ===================== Materials helpers =====================
const UPLOAD_RATE_LIMIT = { last: new Map() } // ip -> timestamp

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
        // break chunk by sentences
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
  // Merge small tail segments
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

async function activateLatestSet(db, { vak, leerjaar, hoofdstuk }) {
  const sets = await getSetsFor(db, { vak, leerjaar, hoofdstuk })
  if (sets.length === 0) return null
  const latest = sets[0]
  await db.collection('material_sets').updateMany({ vak, leerjaar, hoofdstuk }, { $set: { active: false } })
  await db.collection('material_sets').updateOne({ id: latest.id }, { $set: { active: true, updatedAt: new Date() } })
  return latest
}

async function getActiveMaterialSnippet({ vak, leerjaar, hoofdstuk, charLimit = 4500 }) {
  try {
    const db = await connectToMongo()
    const set = await getActiveSet(db, { vak, leerjaar, hoofdstuk })
    if (!set) return null
    const segs = await db.collection('material_segments')
      .find({ setId: set.id })
      .sort({ index: 1 })
      .limit(200)
      .toArray()
    const joined = []
    let total = 0
    for (const s of segs) {
      const t = s.text || ''
      if (total + t.length > charLimit) break
      joined.push(t)
      total += t.length
    }
    return joined.length ? joined.join('\n\n') : null
  } catch (e) { console.error('getActiveMaterialSnippet failed', e); return null }
}

// ===================== Chat helpers =====================
function lerenReply({ vak, leerjaar, hoofdstuk, userText, materialSnippet }) {
  const topic = pick(SUBJECT_TOPICS[vak] || ['kernbegrippen'])
  const useMat = materialSnippet ? `Gebaseerd op je lesmateriaal: ${materialSnippet}\n` : ''
  const explanation = `${useMat}We werken aan ${vak.toLowerCase()} (leerjaar ${leerjaar}, hoofdstuk ${hoofdstuk}). Laten we het hebben over '${topic}'. ${userText ? 'Je vraag: "' + userText + '". ' : ''}Kort uitgelegd: ${topic} betekent dat je het idee stap voor stap kunt toepassen in voorbeelden.`
  const followUp = `Welke stap in ${topic} vind je nog lastig, en waarom denk je dat?`
  return `${explanation}\n\n${followUp}`
}

function overhorenGenerateQuestion({ vak, materialSnippet }) {
  const topic = materialSnippet || pick(SUBJECT_TOPICS[vak] || ['begrip'])
  const stems = [
    `Leg in 1-2 zinnen uit wat ${topic} betekent.`,
    `Noem een voorbeeld van ${topic} en licht kort toe.`,
    `Waarom is ${topic} belangrijk binnen dit hoofdstuk?`,
  ]
  return pick(stems)
}

function overhorenEvaluateAnswer(answer = '') {
  const len = answer.trim().split(/\s+/).length
  if (len >= 20 || /omdat|waardoor|daarom|dus|bijvoorbeeld/i.test(answer)) {
    return { verdict: 'goed', feedback: 'Dit is grotendeels correct en onderbouwd. ✔️', borderline: false }
  }
  if (len >= 10) {
    return { verdict: 'voldoende', feedback: 'Bijna goed, maar geef nog 1 kernpunt of voorbeeld.', borderline: true }
  }
  return { verdict: 'onvoldoende', feedback: 'Te kort of te vaag. Noem het begrip en één concreet voorbeeld.', borderline: false }
}

function makeOefentoetsQuestions({ vak, count, materialSnippet }) {
  const topics = SUBJECT_TOPICS[vak] || ['kernbegrip']
  const questions = []
  for (let i = 0; i < count; i++) {
    const t = materialSnippet || pick(topics)
    const qText = `Vraag ${i + 1}: Leg kort uit wat ${t} betekent en noem één voorbeeld.`
    const expected = [String(t).toLowerCase(), 'voorbeeld']
    questions.push({ id: uuidv4(), text: qText, expected })
  }
  return questions
}

function gradeFromPct(pct) {
  let grade
  if (pct <= 70) grade = 1 + (pct / 70) * (5.5 - 1)
  else grade = 5.5 + ((pct - 70) / 30) * (10 - 5.5)
  return Math.round(grade * 10) / 10
}

function evaluateOefentoets({ questions = [], answers = {} }) {
  const results = questions.map((q) => {
    const ans = (answers[q.id] || '').toLowerCase()
    const matched = (q.expected || []).filter((kw) => ans.includes(kw))
    const correct = matched.length >= Math.max(1, Math.ceil((q.expected || []).length / 2))
    const feedback = correct ? 'Goed beantwoord: je raakt de kern.' : `Nog niet voldoende. Mis je iets als: ${q.expected?.join(', ')}?`
    return { id: q.id, text: q.text, correct, feedback, matched }
  })
  const correctCount = results.filter((r) => r.correct).length
  const total = results.length || 1
  const pct = Math.round((correctCount / total) * 100)
  const grade = gradeFromPct(pct)
  const wrongConcepts = results
    .filter((r) => !r.correct)
    .flatMap((r) => (r.matched?.length ? [] : (r.text.match(/wat (.+?) betekent/i)?.[1] ? [r.text.match(/wat (.+?) betekent/i)[1]] : [])))
  return { results, correctCount, total, pct, grade, wrongConcepts }
}

async function callOpenAI({ mode, messages, systemPrompt, contextPrompt }) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null
  try {
    const payload = { model: 'gpt-4o-mini', messages: [ { role: 'system', content: `${systemPrompt}\n\nContext:\n${contextPrompt || 'Algemene kennis'}` }, ...messages ], temperature: 0.5 }
    const res = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify(payload) })
    if (!res.ok) throw new Error(`OpenAI error: ${res.status}`)
    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content?.trim()
    return content || null
  } catch (e) { console.error('OpenAI call failed:', e.message); return null }
}

// ===================== Main handler =====================
async function handleRoute(request, { params }) {
  const { path = [] } = params
  const route = `/${path.join('/')}`
  const method = request.method

  try {
    if ((route === '/root' || route === '/') && method === 'GET') {
      return handleCORS(NextResponse.json({ message: 'Hello World' }))
    }

    // ===================== Materials API =====================
    if (route === '/materials/upload' && method === 'POST') {
      // simple rate limit: 1 upload per 3 seconds per ip
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
      const now = Date.now()
      const last = UPLOAD_RATE_LIMIT.last.get(ip) || 0
      if (now - last < 3000) return jsonErr('Te snel geüpload. Probeer zo nog eens.', 429)
      UPLOAD_RATE_LIMIT.last.set(ip, now)

      const form = await request.formData().catch(() => null)
      if (!form) return jsonErr('Invalid multipart/form-data')
      const file = form.get('file')
      const vak = String(form.get('vak') || '')
      const leerjaar = String(form.get('leerjaar') || '')
      const hoofdstuk = String(form.get('hoofdstuk') || '')
      const uploader = String(form.get('uploader') || 'onbekend')

      if (!file || typeof file === 'string') return jsonErr('Bestand ontbreekt')
      if (!vak || !leerjaar || !hoofdstuk) return jsonErr('vak, leerjaar en hoofdstuk zijn verplicht')
      if (!/\.pdf$/i.test(file.name || '')) return jsonErr('Alleen .pdf toegestaan')
      if ((file.size || 0) > 10 * 1024 * 1024) return jsonErr('Bestand te groot (max 10MB)')

      const buffer = Buffer.from(await file.arrayBuffer())

      // parse PDF
      let parsed
      try { parsed = await pdfParse(buffer) } catch (e) { console.error('pdf-parse error', e); return jsonErr('Kon PDF niet lezen') }
      const text = cleanText(parsed.text || '')
      if (!text || text.length < 20) return jsonErr('PDF bevat geen leesbare tekst')

      const segments = splitIntoSegments(text, 500, 1500)

      const db = await connectToMongo()
      const set = await ensureNewSet(db, { vak, leerjaar, hoofdstuk })

      const material = {
        id: uuidv4(),
        setId: set.id,
        filename: file.name || 'upload.pdf',
        type: 'pdf',
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
    }

    if (route === '/materials/list' && method === 'GET') {
      const url = new URL(request.url)
      const vak = url.searchParams.get('vak') || ''
      const leerjaar = url.searchParams.get('leerjaar') || ''
      const hoofdstuk = url.searchParams.get('hoofdstuk') || ''
      const db = await connectToMongo()
      const sets = await getSetsFor(db, { vak, leerjaar, hoofdstuk })
      const setIds = sets.map(s => s.id)
      let items = []
      if (setIds.length) {
        const mats = await db.collection('materials').find({ setId: { $in: setIds } }).sort({ createdAt: -1 }).toArray()
        items = mats.map(({ _id, ...rest }) => rest)
      }
      const activeSet = await getActiveSet(db, { vak, leerjaar, hoofdstuk })
      return jsonOk({ items, set: activeSet })
    }

    if (route === '/materials/preview' && method === 'GET') {
      const url = new URL(request.url)
      const id = url.searchParams.get('id')
      if (!id) return jsonErr('id is verplicht')
      const db = await connectToMongo()
      const segs = await db.collection('material_segments').find({ materialId: id }).sort({ index: 1 }).limit(5).toArray()
      const preview = segs.map(s => s.text)
      return jsonOk({ segments: preview })
    }

    if (route === '/materials/activate' && method === 'PUT') {
      const body = await request.json().catch(() => ({}))
      const { vak, leerjaar, hoofdstuk } = body || {}
      if (!vak || !leerjaar || !hoofdstuk) return jsonErr('vak, leerjaar en hoofdstuk zijn verplicht')
      const db = await connectToMongo()
      const latest = await activateLatestSet(db, { vak, leerjaar, hoofdstuk })
      if (!latest) return jsonErr('Geen set gevonden om te activeren', 404)
      return jsonOk({ setId: latest.id, active: true })
    }

    if (route === '/materials/item' && method === 'DELETE') {
      const url = new URL(request.url)
      const id = url.searchParams.get('id')
      if (!id) return jsonErr('id is verplicht')
      const db = await connectToMongo()
      const mat = await db.collection('materials').findOne({ id })
      if (!mat) return jsonErr('Item niet gevonden', 404)
      await db.collection('material_segments').deleteMany({ materialId: id })
      await db.collection('materials').deleteOne({ id })
      // if set now empty, deactivate
      const remainingSegs = await db.collection('material_segments').countDocuments({ setId: mat.setId })
      if (remainingSegs === 0) { await db.collection('material_sets').updateOne({ id: mat.setId }, { $set: { active: false, updatedAt: new Date() } }) }
      return jsonOk({ deleted: true })
    }

    // ===================== Status demo =====================
    if (route === '/status' && method === 'POST') {
      const body = await request.json()
      if (!body.client_name) { return jsonErr('client_name is required', 400) }
      const db = await connectToMongo()
      const statusObj = { id: uuidv4(), client_name: body.client_name, timestamp: new Date() }
      await db.collection('status_checks').insertOne(statusObj)
      return jsonOk(statusObj)
    }

    if (route === '/status' && method === 'GET') {
      const db = await connectToMongo()
      const statusChecks = await db.collection('status_checks').find({}).limit(1000).toArray()
      const cleaned = statusChecks.map(({ _id, ...rest }) => rest)
      return jsonOk(cleaned)
    }

    // ===================== Chat API =====================
    if (route === '/chat' && method === 'POST') {
      const body = await request.json()
      const { messages = [], mode = 'Leren', vak = 'Geschiedenis', leerjaar = '2', hoofdstuk = '1', action, payload, systemPrompt } = body || {}

      const materialSnippet = await getActiveMaterialSnippet({ vak, leerjaar, hoofdstuk })
      const contextPrompt = materialSnippet ? `Lesmateriaal (uittreksel):\n${materialSnippet}` : `Geen lesmateriaal gevonden voor ${vak} leerjaar ${leerjaar} hoofdstuk ${hoofdstuk}`

      if (mode === 'Leren') {
        const lastUser = [...messages].reverse().find((m) => m.role === 'user')
        const userText = lastUser?.content || ''
        const ai = await callOpenAI({ mode, messages, systemPrompt: systemPrompt || 'Studiebot Leren', contextPrompt })
        if (ai) return jsonOk({ message: ai })
        const reply = lerenReply({ vak, leerjaar, hoofdstuk, userText, materialSnippet })
        return jsonOk({ message: reply })
      }

      if (mode === 'Overhoren') {
        const lastAssistantQ = [...messages].reverse().find((m) => m.role === 'assistant' && /Vraag:|Leg .* uit|Noem een voorbeeld/i.test(m.content || ''))
        const lastUser = [...messages].reverse().find((m) => m.role === 'user')
        if (!lastAssistantQ) {
          const q = overhorenGenerateQuestion({ vak, materialSnippet })
          return jsonOk({ message: `Vraag: ${q}` })
        }
        const ans = lastUser?.content || ''
        const { feedback, borderline } = overhorenEvaluateAnswer(ans)
        if (borderline) { return jsonOk({ message: `${feedback}\n\nNog één controlevraag: kun je je antwoord verduidelijken met een concreet voorbeeld?` }) }
        const askNext = Math.random() < 0.6
        if (askNext) {
          const q2 = overhorenGenerateQuestion({ vak, materialSnippet })
          return jsonOk({ message: `${feedback}\n\nVolgende: ${q2}` })
        }
        const reflection = 'Kun je in ongeveer 50 woorden uitleggen wat je in deze paragraaf allemaal geleerd hebt? Neem de tijd. Je mag ook eerst kort iets in je schrift opschrijven als je dat fijn vindt.'
        return jsonOk({ message: `${feedback}\n\n${reflection}` })
      }

      if (mode === 'Oefentoets') {
        if (action === 'start') {
          const count = Math.max(1, Math.min(10, payload?.count || 5))
          const questions = makeOefentoetsQuestions({ vak, count, materialSnippet })
          return jsonOk({ message: 'Oefentoets gestart. Succes! 🎓', data: { questions } })
        }
        if (action === 'submit') {
          const { questions = [], answers = {} } = payload || {}
          const report = evaluateOefentoets({ questions, answers })
          const { correctCount, total, pct, grade } = report
          const summary = `Ingeleverd! Je score: ${correctCount}/${total} (${pct}%). Cijfer: ${grade.toFixed(1)}.`
          const cta = 'Oefen nu met Overhoren op je fouten'
          return jsonOk({ message: `${summary}\n\n${cta}`, data: { report, cta } })
        }
        return jsonErr('Invalid action for Oefentoets', 400)
      }

      return jsonErr('Unknown mode', 400)
    }

    return jsonErr(`Route ${route} not found`, 404)
  } catch (error) {
    console.error('API Error:', error)
    return jsonErr('Internal server error', 500)
  }
}

export const GET = handleRoute
export const POST = handleRoute
export const PUT = handleRoute
export const DELETE = handleRoute
export const PATCH = handleRoute