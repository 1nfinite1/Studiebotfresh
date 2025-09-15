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
function chatOk(message, payload = null, status = 200) {
  const body = payload ? { message, data: payload } : { message }
  return handleCORS(NextResponse.json(body, { status }))
}

export async function OPTIONS() { return handleCORS(new NextResponse(null, { status: 200 })) }

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

function getEnvBool(name, def = true) {
  const v = (process.env[name] || '').toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(v)) return true
  if (['0', 'false', 'no', 'off'].includes(v)) return false
  return def
}
function getEnvInt(name, def) {
  const n = parseInt(process.env[name] || '', 10)
  return Number.isFinite(n) && n >= 0 ? n : def
}

const ACTIVE_SET_TTL_MS = 2 * 60 * 1000
const SNIPPET_TTL_MS = 5 * 60 * 1000
const activeSetCache = new Map()
const snippetCache = new Map()

function k({ vak, leerjaar, hoofdstuk }) { return `${vak}|${leerjaar}|${hoofdstuk}` }

async function getActiveSetFast({ vak, leerjaar, hoofdstuk }) {
  const key = k({ vak, leerjaar, hoofdstuk })
  const now = Date.now()
  const cached = activeSetCache.get(key)
  if (cached && (now - cached.ts) < ACTIVE_SET_TTL_MS) return cached.active
  const db = await connectToMongo()
  const found = await db.collection('material_sets').findOne({ vak, leerjaar, hoofdstuk, active: true })
  const active = !!found
  activeSetCache.set(key, { active, ts: now })
  return active
}

async function getActiveMaterialSnippet({ vak, leerjaar, hoofdstuk, charLimit = 2000 }) {
  const key = k({ vak, leerjaar, hoofdstuk })
  const now = Date.now()
  const cached = snippetCache.get(key)
  if (cached && (now - cached.ts) < SNIPPET_TTL_MS) return cached.text
  const db = await connectToMongo()
  const set = await db.collection('material_sets').findOne({ vak, leerjaar, hoofdstuk, active: true })
  if (!set) return null
  const segs = await db.collection('material_segments')
    .find({ setId: set.id }).sort({ index: 1 }).limit(200).toArray()
  const joined = []
  let total = 0
  for (const s of segs) {
    const t = s.text || ''
    if (total + t.length > charLimit) break
    joined.push(t)
    total += t.length
  }
  const text = joined.length ? joined.join('\n\n') : null
  snippetCache.set(key, { text, ts: now })
  return text
}

const EMOJI = { idea: '💡', book: '📘', brain: '🧠', check: '✅', question: '❓', sparkle: '✨', thumbs: '👍', flex: '💪', cap: '🎓', start: '▶️' }

// Nieuwe Overhoren systeemprompt (natuurlijk, niet-formeel)
const SYS_OVERHORING_NATURAL = `Jij bent Studiebot Overhoren, een vriendelijke en motiverende AI-leerassistent voor het voortgezet onderwijs.
Je taak: de leerling overhoren met toetsachtige vragen, antwoorden beoordelen, en persoonlijke feedback geven.
Je geeft GEEN lange uitleg; houd het kort, positief en toetsgericht.

Stijl:
- Schrijf warm, menselijk en bemoedigend.
- Geef complimenten als er iets goed is. Benoem expliciet wat goed gaat.
- Als een antwoord gedeeltelijk klopt: begin met het positieve, voeg daarna kort toe wat nog ontbreekt.
- Als een antwoord fout is: blijf vriendelijk, leg kort uit wat het juiste antwoord was en geef een eenvoudige vervolgvraag.
- Vermijd kille of zakelijke formuleringen zoals "Mis je nog". Gebruik natuurlijke taal zoals:
  "Je hebt al een belangrijk punt, maar denk ook aan …" of
  "Bij een toets zou dit voldoende zijn, maar je mist nog …".
- Geef het antwoord een rating op een schaal van 1–10.
- Gebruik één of meerdere passende emoji's per bericht wanneer gepast (bijv. ✅, 💡, 📌, 💪) en varieer.

Feedback:
- Pas de feedbacklengte aan de situatie aan (meestal 2–4 zinnen).
- Benoem eventueel hoe dit op een toets beoordeeld zou worden ("voldoende", "goed", "onvolledig").
- Zorg altijd voor een vloeiende overgang naar de volgende vraag met natuurlijke taal ("Laten we verder gaan met de volgende vraag", "Goed, hier komt er nog één").

Didactiek:
- Stel per beurt één duidelijke vraag.
- Houd het gesprek afwisselend: soms een simpele controlevraag, soms een verdiepende vraag.
- Na 3–5 vragen: korte tussenstand geven ("Je hebt X van de Y vragen goed, mooi bezig!").
- Afsluiten: vraag de leerling om in ~50 woorden samen te vatten wat hij/zij geleerd heeft. Geef daarna motiverende eindfeedback.

Grenzen:
- Blijf altijd bij de leerstof.
- Negeer ongepaste input en reageer kort: "Dat hoort niet bij de les, laten we doorgaan."

Belangrijk:
- GEEN vaste formats of repetitieve zinnen.
- Schrijf elke reactie alsof je een persoonlijke tutor bent die in gesprek is met de leerling.`

function hasQuestion(s = '') { return /\?|wat|waarom|hoe|welk|welke|leg uit/i.test(String(s)) }
function emojiForLeren({ userText, hasMaterial }) { if (hasQuestion(userText)) return EMOJI.question; return hasMaterial ? EMOJI.book : EMOJI.idea }
function emojiForLerenSuffix() { return EMOJI.sparkle }
function emojiForOverhorenQuestion() { return EMOJI.question }
function emojiForOverhorenFeedback({ verdict, borderline }) { if (verdict === 'goed') return EMOJI.check; if (borderline) return EMOJI.thumbs; return EMOJI.flex }
function emojiForOverhorenSuffix({ verdict, borderline }) { if (verdict === 'goed') return EMOJI.thumbs; if (borderline) return EMOJI.flex; return EMOJI.flex }
function emojiForReflection() { return EMOJI.sparkle }
function emojiForStartTest() { return EMOJI.cap }
function emojiForStartTestSuffix() { return EMOJI.sparkle }
function emojiForResult(grade) { return grade >= 5.5 ? EMOJI.check : EMOJI.flex }
function emojiForResultSuffix() { return EMOJI.sparkle }

function prefixEmoji(text, emoji) { return `${emoji} ${text}` }
function appendEmoji(text, emoji) { return `${text} ${emoji}` }
function maybeAppendRich(text, emoji, rich) { return rich ? appendEmoji(text, emoji) : text }

function prependEmojiToStream(stream, emoji) { const enc = new TextEncoder(); const prefix = enc.encode(`${emoji} `); const reader = stream.getReader(); return new ReadableStream({ async start(controller) { controller.enqueue(prefix); try { while (true) { const { value, done } = await reader.read(); if (done) break; controller.enqueue(value) } controller.close() } catch (e) { controller.error(e) } } }) }
function appendEmojiToStream(stream, emoji) { const enc = new TextEncoder(); const suffix = enc.encode(` ${emoji}`); const reader = stream.getReader(); let doneOnce = false; return new ReadableStream({ async start(controller) { try { while (true) { const { value, done } = await reader.read(); if (done) break; controller.enqueue(value) } if (!doneOnce) { controller.enqueue(suffix); doneOnce = true } controller.close() } catch (e) { controller.error(e) } } }) }

function lerenReply({ vak, leerjaar, hoofdstuk, userText, materialSnippet }) {
  const intro = materialSnippet ? `📘 Kort uit het materiaal (leerjaar ${leerjaar}, hoofdstuk ${hoofdstuk}): ${materialSnippet.split(/(?<=[.!?])\s+/).slice(0,2).join(' ')}` : `📘 We hebben nog geen actief lesmateriaal gevonden voor ${vak} (leerjaar ${leerjaar}, hoofdstuk ${hoofdstuk}).`
  const prompt = `Wat weet je hier al over? Waar ben je zeker over, en wat wil je nog beter begrijpen?`
  return `${intro}\n\n${prompt}`
}

function trimSpaces(s) { return String(s || '').trim().replace(/\s+/g, ' ') }
function stripLeadingLabels(s) {
  let t = String(s || '')
  t = t.replace(/^\s*(vraag\s*[:\-–—]?\s*)/i, '')
  t = t.replace(/^\s*[0-9]+[).]\s*/, '')
  t = t.replace(/^\s*[-•●▪◦]\s*/, '')
  t = t.replace(/^(samenvatting|hoofdstuk|paragraaf|titel|kernbegrip|begrip|onderwerp)\s*[:\-–—]\s*/i, '')
  t = t.replace(/\s*[0-9]+\.?\s*$/, '')
  return trimSpaces(t)
}
function ensureQuestionForm(raw) {
  let t = stripLeadingLabels(raw)
  const parts = t.split(/(?<=[.!?])\s+/).filter(Boolean)
  const qSentence = parts.find(p => /\?$/.test(p))
  if (qSentence) return trimSpaces(qSentence)
  if (/\?$/.test(t)) return trimSpaces(t)
  if (/^(leg uit|noem|beschrijf|verklaar|vergelijk|waardoor|waarom|hoe|wat|welk|welke)/i.test(t)) return trimSpaces(t + '?')
  if (t.length <= 160) return `Wat wordt bedoeld met '${t}'?`
  return trimSpaces(t.slice(0, 160)) + '?'
}
function extractQuestionFromAssistant(content = '') {
  const c = String(content || '')
  const noEmoji = c.replace(/^\p{Emoji_Presentation}|^\p{Emoji}/u, '').trim()
  // Prefer 'Volgende vraag:'
  if (/Volgende\s*vraag\s*:/i.test(noEmoji)) {
    const after = noEmoji.split(/Volgende\s*vraag\s*:\s*/i).pop()
    const candidate = (after || '').split(/\n/)[0]
    const q = ensureQuestionForm(candidate || after || '')
    if (q) return q
  }
  // Backward-compat: 'Volgende:'
  if (/Volgende\s*:/i.test(noEmoji)) {
    const after = noEmoji.split(/Volgende\s*:\s*/i).pop()
    const candidate = (after || '').split(/\n/)[0]
    const q = ensureQuestionForm(candidate || after || '')
    if (q) return q
  }
  // Else look for explicit 'Vraag:'
  if (/Vraag\s*:/i.test(noEmoji)) {
    const after = noEmoji.split(/Vraag\s*:\s*/i).pop()
    const candidate = (after || '').split(/\n/)[0]
    const q = ensureQuestionForm(candidate || after || '')
    if (q) return q
  }
  // Fallback: last sentence that ends with '?'
  const parts = noEmoji.split(/(?<=[.!?])\s+/).filter(Boolean)
  for (let i = parts.length - 1; i >= 0; i--) { if (/\?$/.test(parts[i])) return ensureQuestionForm(parts[i]) }
  return ensureQuestionForm(noEmoji)
}

// --- Validators & Sanitizers ---
function limitWords(s, max = 120) {
  const parts = String(s || '').trim().split(/\s+/)
  if (parts.length <= max) return parts.join(' ')
  return parts.slice(0, max).join(' ')
}
function sanitizeStrLen(s, maxLen = 700) {
  const t = String(s || '').trim()
  if (t.length <= maxLen) return t
  return t.slice(0, maxLen).trim()
}
function normalizeVerdict(v) {
  const s = String(v || '').toLowerCase()
  if (s === 'goed' || s === 'voldoende' || s === 'onvoldoende') return s
  return null
}
function clipQuestion(q, maxLen = 200) {
  let t = ensureQuestionForm(String(q || ''))
  if (t.length > maxLen) t = t.slice(0, maxLen - 1).trim() + '?'
  return t
}
// convert any JSON value to plain text for safe UI output
function toPlainText(val) {
  if (val == null) return ''
  if (typeof val === 'string') return val
  if (Array.isArray(val)) return val.map(toPlainText).filter(Boolean).join(' ')
  if (typeof val === 'object') {
    if (typeof val.text === 'string') return val.text
    const vals = Object.values(val).map(toPlainText).filter(Boolean)
    return vals.join(' ')
  }
  return String(val)
}
function toStringArray(val, maxItems = 3, maxLen = 80) {
  const arr = Array.isArray(val) ? val : (val == null ? [] : [val])
  const out = []
  for (const it of arr) {
    const s = sanitizeStrLen(toPlainText(it), maxLen)
    if (s) out.push(s)
    if (out.length >= maxItems) break
  }
  return out
}

// --- Natural phrasing templates for Overhoren ---
const SCORE_TEMPLATES = [
  'Dit zou op een toets waarschijnlijk een {score}/10 zijn.',
  'Mijn toetsinschatting: {score}/10.',
  'Op een toets komt dit neer op ongeveer {score}/10.',
  'Ik zou dit nu inschatten op {score}/10.'
]
const NEXT_TEMPLATES = [
  'Laten we doorgaan met de volgende vraag: {q}',
  'Goed bezig — hier komt er nog één: {q}',
  'Klaar voor de volgende? {q}',
  'Probeer deze eens: {q}'
]
const MISSING_TEMPLATES = [
  'Denk ook aan:',
  'Noem ook kort:',
  'Wat nog ontbreekt:',
  'Handig om mee te nemen:'
]
function renderOverhorenFeedback({ opening, missingPoints = [], score, nextQ }) {
  const parts = []
  const cleanOpening = sanitizeStrLen(toPlainText(opening) || '', 600)
  if (cleanOpening) parts.push(cleanOpening)
  const miss = toStringArray(missingPoints, 3, 80)
  if (miss.length) {
    const lead = pick(MISSING_TEMPLATES)
    parts.push(`${lead}\n- ${miss.join('\n- ')}`)
  }
  if (Number.isFinite(score)) {
    const tpl = pick(SCORE_TEMPLATES)
    parts.push(tpl.replace('{score}', String(Math.round(score))))
  }
  if (nextQ) {
    const tpl = pick(NEXT_TEMPLATES)
    parts.push(tpl.replace('{q}', ensureQuestionForm(toPlainText(nextQ))))
  }
  return limitWords(parts.join('\n\n'), 120)
}

function overhorenGenerateQuestion({ vak, materialSnippet }) {
  const base = materialSnippet || (SUBJECT_TOPICS[vak] || []).join(', ')
  const sentences = String(base).split(/(?<=[.!?])\s+/).filter(Boolean)
  const s = sentences.find(x => x.length > 15) || sentences[0] || 'Leg kort uit wat het kernbegrip betekent.'
  return ensureQuestionForm(s)
}
async function overhorenGenerateQuestionLLM({ vak, materialSnippet }) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null
  try {
    const sys = SYS_OVERHORING_NATURAL + "\n\nBELANGRIJK: Antwoord ALLEEN met JSON volgens het gevraagde schema."
    const user = `Genereer in het Nederlands precies één echte overhoorvraag over dit hoofdstuk. Regels:\n- Geef alleen de vraagzin, eindigend met een vraagteken\n- Geen titel, geen "Vraag:", geen nummering of bullets\n- Gebruik uitsluitend informatie uit het materiaal\n- Houd het compact (1 zin)\n\nMateriaal:\n${materialSnippet || 'GEEN MATERIAAL'}\n\nAntwoord uitsluitend met JSON-object {"question":"..."}.`
    const payload = { model: 'gpt-4o-mini', messages: [ { role:'system', content: sys }, { role:'user', content: user } ], temperature: 0.2 }
    const res = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify(payload) })
    if (!res.ok) return null
    const data = await res.json()
    const raw = data?.choices?.[0]?.message?.content?.trim() || ''
    let q
    try { q = JSON.parse(raw)?.question } catch {
      const m = raw.match(/\{[\s\S]*\}/)
      if (m) { try { q = JSON.parse(m[0])?.question } catch {} }
    }
    if (!q) return null
    return ensureQuestionForm(q)
  } catch { return null }
}
async function overhorenEvaluateLLM({ question, answer, materialSnippet }) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null
  try {
    const sys = SYS_OVERHORING_NATURAL + "\n\nBELANGRIJK: Formuleer ZELF het volledige antwoord als vrije tekst. Geen JSON."
    const user = `Je beoordeelt het antwoord van een leerling en reageert kort en warm (2–4 zinnen), gevolgd door:\n- 1–3 korte bullets met ontbrekende elementen (elk op een nieuwe regel, beginnend met "- ")\n- Eén scorezin met variatie, bijv.: "Dit zou op een toets waarschijnlijk een 7/10 zijn." of "Mijn toetsinschatting: 7/10."\n- Een natuurlijke overgang naar de volgende vraag, met prefix "Volgende:" en precies één vraag die eindigt op ?\nBeperk tot ~120 woorden totaal. Gebruik alleen informatie uit het materiaal. Varieer emoji's passend.\n\nVraag:\n${question}\n\nAntwoord leerling:\n${answer}\n\nMateriaal:\n${materialSnippet || 'GEEN MATERIAAL'}\n\nSchrijf nu de volledige reactie als vrije tekst (geen JSON).`
    const payload = { model: 'gpt-4o-mini', messages: [ { role:'system', content: sys }, { role:'user', content: user } ], temperature: 0.3 }
    const res = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify(payload) })
    if (!res.ok) return null
    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content?.trim() || ''
    if (!content) return null
    // Ensure there is a next question; if not, add a simple follow-up
    const hasQ = /\?\s*$/.test(content) || /Volgende\s*vraag\s*:\s*.+\?/i.test(content) || /Volgende\s*:\s*.+\?/i.test(content)
    let final = content
    if (!hasQ) {
      const fallbackQ = ensureQuestionForm('Kun je een concreet voorbeeld geven?')
      final = content + `\n\nVolgende: ${fallbackQ}`
    }
    return final
  } catch { return null }
}

function overhorenEvaluateAnswer(answer = '') {
  const len = answer.trim().split(/\s+/).length
  if (len >= 20 || /omdat|waardoor|daarom|dus|bijvoorbeeld/i.test(answer)) {
    return { verdict: 'goed', feedback: 'Dit is grotendeels correct en onderbouwd.', borderline: false }
  }
  if (len >= 10) {
    return { verdict: 'voldoende', feedback: 'Bijna goed, maar geef nog 1 kernpunt of voorbeeld.', borderline: true }
  }
  return { verdict: 'onvoldoende', feedback: 'Te kort of te vaag. Noem het begrip en één concreet voorbeeld.', borderline: false }
}

async function makeOefentoetsQuestions({ vak, count, materialSnippet }) {
  const MAX_LEN = 120
  const stop = new Set(['de','het','een','en','of','maar','want','dus','ook','niet','wel','bij','voor','na','met','zonder','op','in','aan','van','tot','als','dan','die','dat','dit','daar','hier','er','te','ten','per','zoals','door','over','onder','boven','tussen','tegen','heen','om','je','jij','jou','jouw','uw','wij','we','ons','onze','zij','hun','ze','ik','mijn','haar','zijn'])
  const limitLen = (s) => { let t = String(s||'').trim().replace(/\s+/g,' '); return t.length <= MAX_LEN ? t : t.slice(0, MAX_LEN).trim() }
  const keywordsFromQuestion = (q) => {
    const words = String(q).toLowerCase().replace(/[^a-zà-öø-ÿ0-9\s-]/g,' ').split(/\s+/).filter(w => w && w.length >= 4 && !stop.has(w))
    const uniq = []; const seen = new Set();
    for (const w of words) { if (!seen.has(w)) { seen.add(w); uniq.push(w) } }
    return uniq.slice(0, 4)
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (apiKey) {
    try {
      const sys = 'Je bent een docent die toetsvragen opstelt. Gebruik uitsluitend de gegeven context. Geef uitsluitend een JSON-array van vragen (strings), zonder extra uitleg.'
      const user = `Genereer ${count} toetsvragen in het Nederlands over het onderstaande hoofdstuk. Regels:\n- Maximaal ${MAX_LEN} tekens per vraag (harde bovengrens)\n- Vragen moeten kort en duidelijk zijn (1-2 zinnen is ok, maar houd het compact)\n- Gebruik uitsluitend informatie uit het materiaal; geen nieuwe feiten verzinnen\n- Geen nummering toevoegen; alleen de vraagzinnen\n\nMateriaal:\n${materialSnippet || 'GEEN MATERIAAL'}\n\nAntwoord uitsluitend met JSON-array van strings.`
      const payload = { model: 'gpt-4o-mini', messages: [ { role:'system', content: sys }, { role:'user', content: user } ], temperature: 0.2 }
      const res = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify(payload) })
      if (res.ok) {
        const data = await res.json()
        const raw = data?.choices?.[0]?.message?.content?.trim() || '[]'
        let arr
        try { arr = JSON.parse(raw) } catch { arr = (raw.match(/\[(.|\n|\r)*\]/) ? JSON.parse(raw.match(/\[(.|\n|\r)*\]/)[0]) : []) }
        if (Array.isArray(arr) && arr.length) {
          const qs = arr.slice(0, count).map((q, i) => {
            const txt = limitLen(String(q||''))
            return { id: uuidv4(), text: `Vraag ${i+1}: ${txt}`, expected: keywordsFromQuestion(txt) }
          })
          if (qs.length) return qs
        }
      }
    } catch (e) {
      console.warn('LLM question gen failed, falling back', e?.message || e)
    }
  }
  const base = materialSnippet || (SUBJECT_TOPICS[vak] || []).join(', ')
  const sentences = String(base).split(/(?<=[.!?])\s+/).filter(Boolean)
  const picked = sentences.slice(0, Math.max(1, count))
  const qs = picked.map((s, i) => { const txt = limitLen(s.replace(/^\s*[0-9]+[).]\s*/,'').replace(/^[-•]\s*/,'').replace(/^\s*/,'').replace(/\s+/g,' ')); return { id: uuidv4(), text: `Vraag ${i+1}: ${txt}`, expected: keywordsFromQuestion(txt) } })
  return qs
}
function gradeFromPct(pct) { let grade; if (pct <= 70) grade = 1 + (pct / 70) * (5.5 - 1); else grade = 5.5 + ((pct - 70) / 30) * (10 - 5.5); return Math.round(grade * 10) / 10 }
function evaluateOefentoets({ questions = [], answers = {} }) { const results = questions.map((q) => { const ansRaw = String(answers[q.id] || ''); const ans = ansRaw.toLowerCase(); const matched = (q.expected || []).filter((kw) => ans.includes(kw)); const threshold = Math.max(1, Math.ceil((q.expected || []).length / 2)); const correct = matched.length >= threshold; const evaluation = correct ? 'juist' : (matched.length > 0 ? 'onvolledig' : 'fout'); const feedback = correct ? 'Goed beantwoord: je raakt de kern.' : (matched.length > 0 ? `Bijna goed, je raakt al een deel. Denk aan: ${q.expected?.join(', ')}` : `Nog niet voldoende. Mis je iets als: ${q.expected?.join(', ')}?`); return { id: q.id, text: q.text, correct, evaluation, feedback, matched, answer: ansRaw } }); const correctCount = results.filter((r) => r.correct).length; const total = results.length || 1; const pct = Math.round((correctCount / total) * 100); const grade = gradeFromPct(pct); const wrongConcepts = results.filter((r) => !r.correct).flatMap((r) => (r.matched?.length ? [] : (r.text.match(/wat (.+?) betekent/i)?.[1] ? [r.text.match(/wat (.+?) betekent/i)[1]] : []))); return { results, correctCount, total, pct, grade, wrongConcepts } }

async function evaluateOefentoetsLLM({ questions = [], answers = {}, materialSnippet }) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null
  try {
    const baseline = evaluateOefentoets({ questions, answers })
    const qa = questions.map(q => ({ id: q.id, text: q.text, answer: String(answers[q.id] || '').trim() }))
    const sys = 'Je bent een ervaren vakdocent. Lees toetsvragen met leerling-antwoorden en beoordeel zorgvuldig per vraag op basis van de context. Antwoord ALLEEN met JSON volgens het schema. Wees eerlijk, kort en behulpzaam in feedback.'
    const user = `Context (lesmateriaal):\n${materialSnippet || 'GEEN MATERIAAL'}\n\nBeoordeel deze antwoorden. Regels:\n- Per vraag: evaluatie = "juist" | "onvolledig" | "fout"\n- Geef korte, concrete feedback in leerlingentaal en (indien nuttig) een beknopt modelantwoord\n- Gebruik ALLEEN info uit het materiaal (verzin niets nieuws)\n- Maak ook een algemene samenvatting en 2–4 aanbevelingen om te oefenen\n- Bereken score: correct = aantal 'juist'\n- Cijfer (1.0–10.0): 5.5 bij 70%, 10 bij 100%, 1 bij 0% (afronden op 1 decimaal)\n- Lever STRENG JSON, geen extra tekst\n\nInput:\n${JSON.stringify(qa)}\n\nUitvoer JSON precies zo:\n{\n  "results": [\n    {"id":"...","text":"...","evaluation":"juist|onvolledig|fout","feedback":"...","model_answer":"..."}\n  ],\n  "overall": {"correctCount":0,"total":0,"pct":0,"grade":0.0,"summary":"...","recommendations":["...","..."] ,"wrong_concepts":["..."]}\n}`
    const payload = { model: 'gpt-4o-mini', messages: [ { role:'system', content: sys }, { role:'user', content: user } ], temperature: 0.2 }
    const res = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify(payload) })
    if (!res.ok) return null
    const data = await res.json()
    const raw = data?.choices?.[0]?.message?.content?.trim() || ''
    let obj
    try { obj = JSON.parse(raw) } catch {
      const m = raw.match(/\{[\s\S]*\}/)
      if (m) { try { obj = JSON.parse(m[0]) } catch {} }
    }
    if (!obj || !Array.isArray(obj.results)) return null

    const evalNorm = (v) => {
      const s = String(v || '').toLowerCase()
      if (s === 'juist' || s === 'onvolledig' || s === 'fout') return s
      return null
    }
    const sanitizeStr = (s, max = 500) => String(s || '').trim().slice(0, max)
    const arrStrings = (a, maxItems = 6, maxLen = 140) => Array.isArray(a) ? a.map(x => sanitizeStr(x, maxLen)).filter(Boolean).slice(0, maxItems) : []

    const byId = new Map((obj.results || []).map(r => [String(r.id || ''), r]))
    const finalResults = questions.map((q) => {
      const r = byId.get(String(q.id)) || {}
      const evaluation = evalNorm(r.evaluation) || (baseline.results.find(b => b.id === q.id)?.evaluation || (baseline.results.find(b => b.id === q.id)?.correct ? 'juist' : 'fout'))
      const correct = evaluation === 'juist'
      const feedback = sanitizeStr(r.feedback || (baseline.results.find(b => b.id === q.id)?.feedback || ''))
      const model_answer = sanitizeStr(r.model_answer || '')
      const text = sanitizeStr(r.text || q.text || '', 300)
      const answer = String(answers[q.id] || '')
      return { id: q.id, text, correct, evaluation, feedback, model_answer, answer }
    })

    const total = finalResults.length || 1
    let correctCount = finalResults.filter(r => r.correct).length
    if (Number.isFinite(Number(obj?.overall?.correctCount))) correctCount = Number(obj.overall.correctCount)
    const pct = Math.round((correctCount / total) * 100)
    let grade = Number(obj?.overall?.grade)
    if (!Number.isFinite(grade)) { grade = gradeFromPct(pct) }
    const wrongConcepts = arrStrings(obj?.overall?.wrong_concepts, 5, 80)
    const summary = sanitizeStr(obj?.overall?.summary || '', 600)
    const recommendations = arrStrings(obj?.overall?.recommendations, 6, 140)

    return { results: finalResults, correctCount, total, pct, grade, wrongConcepts, summary, recommendations }
  } catch (e) {
    console.warn('LLM evaluateOefentoets failed', e?.message || e)
    return null
  }
}

async function callOpenAIStream({ messages, systemPrompt, contextPrompt }) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null
  const payload = { model: 'gpt-4o-mini', stream: true, temperature: 0.5, messages: [ { role: 'system', content: `${systemPrompt}\n\nContext:\n${contextPrompt || 'Algemene kennis'}` }, ...messages ] }
  const res = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify(payload) })
  if (!res.ok) throw new Error(`OpenAI error: ${res.status}`)
  return res
}

function sseToTextStream(readable) { const reader = readable.getReader(); const decoder = new TextDecoder(); return new ReadableStream({ async start(controller) { let buffer = ''; try { while (true) { const { value, done } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); const lines = buffer.split('\n'); buffer = lines.pop() || ''; for (const line of lines) { const trimmed = line.trim(); if (!trimmed || !trimmed.startsWith('data:')) continue; const data = trimmed.slice(5).trim(); if (data === '[DONE]') { controller.close(); return } try { const json = JSON.parse(data); const delta = json.choices?.[0]?.delta?.content; if (delta) controller.enqueue(new TextEncoder().encode(delta)) } catch {} } } controller.close() } catch (e) { controller.error(e) } } }) }

export async function POST(request) {
  try {
    const url = new URL(request.url)
    const stream = url.searchParams.get('stream') === '1'
    const body = await request.json()
    const { messages = [], mode = 'Leren', vak = 'Geschiedenis', leerjaar = '2', hoofdstuk = '1', action, payload, systemPrompt, richEmoji, contextOverride } = body || {}

    const STREAMING_ENABLED = getEnvBool('CHAT_STREAMING', true)
    const USE_CONTEXT = getEnvBool('CHAT_USE_CONTEXT', true)
    const SNIPPET_CHAR_LIMIT = getEnvInt('SNIPPET_CHAR_LIMIT', 2000)

    let materialSnippet = null
    let contextPrompt = 'Algemene kennis'
    if (contextOverride && String(contextOverride).trim()) {
      const limit = SNIPPET_CHAR_LIMIT > 0 ? SNIPPET_CHAR_LIMIT : 4000
      materialSnippet = String(contextOverride).slice(0, limit)
      contextPrompt = `Lesmateriaal (lokaal):\n${materialSnippet}`
    } else if (USE_CONTEXT && SNIPPET_CHAR_LIMIT > 0) {
      const hasActive = await getActiveSetFast({ vak, leerjaar, hoofdstuk })
      if (hasActive) {
        materialSnippet = await getActiveMaterialSnippet({ vak, leerjaar, hoofdstuk, charLimit: SNIPPET_CHAR_LIMIT })
      }
      contextPrompt = materialSnippet ? `Lesmateriaal (uittreksel):\n${materialSnippet}` : `Geen lesmateriaal gevonden voor ${vak} leerjaar ${leerjaar} hoofdstuk ${hoofdstuk}`
    }

    // ---------- Leren ----------
    if (mode === 'Leren' && stream && STREAMING_ENABLED) {
      try {
        const userText = [...messages].reverse().find((m) => m.role === 'user')?.content || ''
        const pre = emojiForLeren({ userText, hasMaterial: !!materialSnippet })
        const suf = emojiForLerenSuffix()
        const aiRes = await callOpenAIStream({ messages, systemPrompt: systemPrompt || 'Studiebot Leren', contextPrompt })
        if (aiRes) {
          const textStream = sseToTextStream(aiRes.body)
          let wrapped = prependEmojiToStream(textStream, pre)
          if (richEmoji) wrapped = appendEmojiToStream(wrapped, suf)
          return handleCORS(new Response(wrapped, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }))
        }
      } catch (e) {
        const lastUser = [...messages].reverse().find((m) => m.role === 'user')
        const userText = lastUser?.content || ''
        const pre = emojiForLeren({ userText, hasMaterial: !!materialSnippet })
        const suf = emojiForLerenSuffix()
        let mock = lerenReply({ vak, leerjaar, hoofdstuk, userText, materialSnippet })
        mock = prefixEmoji(mock, pre)
        if (richEmoji) mock = appendEmoji(mock, suf)
        const encoder = new TextEncoder()
        const chunks = mock.match(/.{1,120}/g) || [mock]
        const stream = new ReadableStream({ async start(controller) { for (const part of chunks) { controller.enqueue(encoder.encode(part)); await new Promise(r => setTimeout(r, 20)) } controller.close() } })
        return handleCORS(new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }))
      }
    }

    if (mode === 'Leren') {
      const lastUser = [...messages].reverse().find((m) => m.role === 'user')
      const userText = lastUser?.content || ''
      const pre = emojiForLeren({ userText, hasMaterial: !!materialSnippet })
      const suf = emojiForLerenSuffix()
      const apiKey = process.env.OPENAI_API_KEY
      if (apiKey) {
        try {
          const payload = { model: 'gpt-4o-mini', messages: [ { role: 'system', content: `${systemPrompt || 'Studiebot Leren'}\n\nContext:\n${contextPrompt}` }, ...messages ], temperature: 0.5 }
          const resAI = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify(payload) })
          if (resAI.ok) {
            const dataAI = await resAI.json()
            const content = dataAI?.choices?.[0]?.message?.content?.trim()
            if (content) return chatOk(maybeAppendRich(prefixEmoji(content, pre), suf, richEmoji))
          }
        } catch {}
      }
      const reply = lerenReply({ vak, leerjaar, hoofdstuk, userText, materialSnippet })
      return chatOk(maybeAppendRich(prefixEmoji(reply, pre), suf, richEmoji))
    }

    // ---------- Overhoren ----------
    if (mode === 'Overhoren') {
      const lastAssistantQ = [...messages].reverse().find((m) => m.role === 'assistant' && /(Volgende\s*vraag\s*:|Volgende\s*:|Vraag\s*:|\?)/i.test(m.content || ''))
      const lastUser = [...messages].reverse().find((m) => m.role === 'user')
      if (!lastAssistantQ) {
        const pre = emojiForOverhorenQuestion()
        let q = await overhorenGenerateQuestionLLM({ vak, materialSnippet })
        if (!q) q = overhorenGenerateQuestion({ vak, materialSnippet })
        const text = prefixEmoji(`Vraag: ${q}`, pre)
        return chatOk(maybeAppendRich(text, EMOJI.question, richEmoji))
      }
      const ans = lastUser?.content || ''
      const qPrev = extractQuestionFromAssistant(lastAssistantQ.content || '')
      let evalObj = await overhorenEvaluateLLM({ question: qPrev, answer: ans, materialSnippet })
      if (!evalObj) {
        const basic = overhorenEvaluateAnswer(ans)
        const pre = emojiForOverhorenFeedback({ verdict: basic.verdict, borderline: basic.borderline })
        const suf = emojiForOverhorenSuffix({ verdict: basic.verdict, borderline: basic.borderline })
        const q2 = overhorenGenerateQuestion({ vak, materialSnippet })
        const borderlineMsg = basic.borderline ? `\n\nNog één controlevraag: kun je je antwoord verduidelijken met een concreet voorbeeld?` : ''
        const text = basic.borderline ? `${basic.feedback}${borderlineMsg}` : `${basic.feedback}\n\nVolgende: ${q2}`
        return chatOk(maybeAppendRich(prefixEmoji(text, pre), suf, richEmoji))
      }
      const { verdict, opening_feedback, missing_points, score_answer, next_question } = evalObj
      const pre = emojiForOverhorenFeedback({ verdict, borderline: verdict === 'voldoende' })
      const suf = emojiForOverhorenSuffix({ verdict, borderline: verdict === 'voldoende' })
      const message = renderOverhorenFeedback({ opening: opening_feedback, missingPoints: missing_points, score: score_answer, nextQ: next_question })
      return chatOk(maybeAppendRich(prefixEmoji(message, pre), suf, richEmoji))
    }

    // ---------- Oefentoets ----------
    if (mode === 'Oefentoets') {
      if (action === 'start') {
        const count = Math.max(1, Math.min(10, payload?.count || 5))
        const questions = await makeOefentoetsQuestions({ vak, count, materialSnippet })
        const out = prefixEmoji('Oefentoets gestart. Succes!', emojiForStartTest())
        return chatOk(maybeAppendRich(out, emojiForStartTestSuffix(), richEmoji), { questions })
      }
      if (action === 'submit') {
        const { questions = [], answers = {} } = payload || {}
        let report = await evaluateOefentoetsLLM({ questions, answers, materialSnippet })
        if (!report) { report = evaluateOefentoets({ questions, answers }) }
        const { correctCount, total, pct, grade } = report
        const baseSummary = `Ingeleverd! Je score: ${correctCount}/${total} (${pct}%). Cijfer: ${Number(grade).toFixed(1)}.`
        const more = report.summary ? `\n\n${report.summary}` : ''
        const recs = Array.isArray(report.recommendations) && report.recommendations.length ? `\n\nAanbevelingen: • ${report.recommendations.join(' • ')}` : ''
        const cta = 'Oefen nu met Overhoren op je fouten'
        const out = prefixEmoji(`${baseSummary}${more}${recs}\n\n${cta}`, emojiForResult(grade))
        return chatOk(maybeAppendRich(out, emojiForResultSuffix(), richEmoji), { report, cta })
      }
      return jsonErr('Invalid action for Oefentoets', 400)
    }

    return jsonErr('Unknown mode', 400)
  } catch (error) {
    console.error('API Error:', error)
    return jsonErr('Internal server error', 500)
  }
}