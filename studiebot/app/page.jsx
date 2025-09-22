'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { getLLMClient } from '../infra/llm/index'
import { GlossaryProvider, useGlossary } from '../src/glossary/GlossaryProvider'
import { EmojiModeProvider } from '../src/emoji/EmojiModeContext'
import { EmojiModeToggle } from '../components/EmojiModeToggle'
import { ProcessedText } from '../src/lib/textProcessor'
import { HintBubble } from '../src/hints/HintBubble'
import { shouldShowHint } from '../src/lib/messageUtils'

// Minimal UI debug flag
const UI_DEBUG = process.env.NEXT_PUBLIC_UI_DEBUG === 'true'
const dlog = (...args) => { if (UI_DEBUG) console.log(...args) }

const SUBJECTS = [ 'Nederlands', 'Engels', 'Geschiedenis', 'Aardrijkskunde', 'Wiskunde', 'Natuurkunde', 'Scheikunde', 'Biologie', 'Economie', 'Maatschappijleer' ]
const YEARS = ['1', '2', '3', '4', '5', '6']

const defaultGuidance = { leren: '', overhoren: '', oefentoets: '' }

// Runtime backend URL helper
import { getBackendUrl } from '../src/lib/backendUrl'
async function apiFetch(path, options) {
  const base = await getBackendUrl()
  const url = `${base}${path}`
  return fetch(url, options)
}

const IconBack = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
)

const Chip = ({ children }) => <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm text-white/90 ring-1 ring-white/25">{children}</span>

function FullButton({ children, onClick, variant = 'primary', size = 'default' }) {
  const base = 'w-full rounded-xl font-semibold transition'
  const color = variant === 'secondary' ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-white text-purple-700 hover:bg-purple-100'
  const sizing = size === 'compact' ? 'py-2.5 text-lg' : size === 'mode' ? 'min-h-14 py-3.5 px-6 text-lg' : 'py-4 text-lg'
  return (
    <button onClick={onClick} className={`${base} ${color} ${sizing}`}>
      {children}
    </button>
  )
}

const Card = ({ children }) => <div className="w-full max-w-2xl rounded-2xl bg-white/10 p-6 shadow-xl ring-1 ring-white/20 backdrop-blur">{children}</div>
const FadeSlide = ({ show, children }) => <div className={`transition-all duration-300 ${show ? 'opacity-100 translate-y-0' : 'pointer-events-none opacity-0 translate-y-3'}`}>{children}</div>

function useLocalStorage(key, initialValue) {
  const [state, setState] = useState(() => {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : initialValue } catch { return initialValue }
  })
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(state)) } catch {} }, [key, state])
  return [state, setState]
}

function LLMNotice() {
  const enabled = (process.env.NEXT_PUBLIC_LLM_ENABLED === 'true')
  if (enabled) return null
  return (
    <div data-testid="llm-disabled" className="mx-auto mb-2 w-[min(92vw,920px)] rounded-xl bg-white/15 px-3 py-2 text-sm ring-1 ring-white/20">
      <span className="font-semibold">LLM uitgeschakeld:</span> er worden voorbeeldantwoorden gebruikt (UI-only modus).
    </div>
  )
}

function HeaderBar({ step, setStep }) {
  return (
    <div className="container mx-auto flex items-center gap-3 py-4">
      {step > 0 && (
        <button onClick={() => setStep((s) => Math.max(0, s - 1))} className="rounded-full bg-white/20 p-2 ring-1 ring-white/30 hover:bg-white/30" aria-label="Ga terug">
          <IconBack />
        </button>
      )}
      <h1 className="text-xl font-bold">Studiebot</h1>
    </div>
  )
}

function HeaderConfig({ guidance, setGuidance, isTeacher, setIsTeacher }) {
  const [open, setOpen] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)
  const [showLeren, setShowLeren] = useState(false)
  const [showOverhoren, setShowOverhoren] = useState(false)
  const [showOefentoets, setShowOefentoets] = useState(false)
  return (
    <div className="container mx-auto mb-2 flex items-center justify-end">
      <button onClick={() => setOpen(!open)} className="rounded-lg bg-white/15 px-3 py-2 text-sm ring-1 ring-white/25 hover:bg-white/25">Config</button>
      {open && (
        <div className="absolute left-1/2 top-20 z-50 w-[min(90vw,960px)] -translate-x-1/2 rounded-2xl bg-white p-4 text-purple-900 shadow-2xl">
          <div className="space-y-3">
            <div className="rounded-md border border-purple-200">
              <button onClick={() => setShowInstructions(v => !v)} className="flex w-full items-center justify-between px-3 py-2 text-left">
                <span className="text-sm font-bold">Instructies</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={`text-purple-700 transition-transform ${showInstructions ? 'rotate-180' : ''}`}><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              {showInstructions && (
                <div className="border-t border-purple-200 p-3 space-y-3">
                  <div className="rounded-md border border-purple-200">
                    <button onClick={() => setShowLeren(v => !v)} className="flex w-full items-center justify-between px-3 py-2 text-left">
                      <span className="text-sm font-bold">Studiebot Leren</span>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={`text-purple-700 transition-transform ${showLeren ? 'rotate-180' : ''}`}><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                    {showLeren && (
                      <div className="border-t border-purple-200 p-3">
                        <label className="mb-1 block text-sm font-semibold">{'Pro' + 'mpt'} voor Leren</label>
                        <textarea value={guidance.leren} onChange={(e) => setGuidance({ ...guidance, leren: e.target.value })} className="h-40 w-full rounded-md border border-purple-200 bg-purple-50/50 p-2 text-sm outline-none ring-purple-300 focus:ring" />
                      </div>
                    )}
                  </div>

                  <div className="rounded-md border border-purple-200">
                    <button onClick={() => setShowOverhoren(v => !v)} className="flex w-full items-center justify-between px-3 py-2 text-left">
                      <span className="text-sm font-bold">Studiebot Overhoren</span>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={`text-purple-700 transition-transform ${showOverhoren ? 'rotate-180' : ''}`}><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                    {showOverhoren && (
                      <div className="border-t border-purple-200 p-3">
                        <label className="mb-1 block text-sm font-semibold">{'Pro' + 'mpt'} voor Overhoren</label>
                        <textarea value={guidance.overhoren} onChange={(e) => setGuidance({ ...guidance, overhoren: e.target.value })} className="h-40 w-full rounded-md border border-purple-200 bg-purple-50/50 p-2 text-sm outline-none ring-purple-300 focus:ring" />
                      </div>
                    )}
                  </div>

                  <div className="rounded-md border border-purple-200">
                    <button onClick={() => setShowOefentoets(v => !v)} className="flex w-full items-center justify-between px-3 py-2 text-left">
                      <span className="text-sm font-bold">Studiebot Oefentoets</span>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={`text-purple-700 transition-transform ${showOefentoets ? 'rotate-180' : ''}`}><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                    {showOefentoets && (
                      <div className="border-t border-purple-200 p-3">
                        <label className="mb-1 block text-sm font-semibold">{'Pro' + 'mpt'} voor Oefentoets</label>
                        <textarea value={guidance.oefentoets} onChange={(e) => setGuidance({ ...guidance, oefentoets: e.target.value })} className="h-40 w-full rounded-md border border-purple-200 bg-purple-50/50 p-2 text-sm outline-none ring-purple-300 focus:ring" />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between rounded-md bg-purple-50 p-3">
              <label htmlFor="is-teacher" className="text-sm font-semibold text-purple-700">Ik ben docent/beheerder</label>
              <input id="is-teacher" type="checkbox" checked={isTeacher} onChange={(e) => setIsTeacher(e.target.checked)} />
            </div>

            <div className="mt-2 flex items-center justify-between rounded-md bg-purple-50 p-3">
              <EmojiModeToggle />
            </div>

            {isTeacher && <MaterialsAdmin />}

            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setGuidance(defaultGuidance)} className="rounded-md bg-purple-100 px-3 py-1 text-sm font-semibold text-purple-700 hover:bg-purple-200">Reset naar standaard</button>
              <button onClick={() => setOpen(false)} className="rounded-md bg-purple-600 px-3 py-1 text-sm font-semibold text-white hover:bg-purple-700">Sluiten</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MaterialsAdmin() {
  const [vak, setVak] = useState('Geschiedenis')
  const [leerjaar, setLeerjaar] = useState('2')
  const [hoofdstuk, setHoofdstuk] = useState('1')
  const [items, setItems] = useState([])
  const [setInfo, setSetInfo] = useState(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState('')
  const [seedText, setSeedText] = useState('')

  const refresh = async () => {
    setLoading(true)
    try {
      const url = `/api/materials/list?vak=${encodeURIComponent(vak)}&leerjaar=${encodeURIComponent(leerjaar)}&hoofdstuk=${encodeURIComponent(hoofdstuk)}`
      const res = await apiFetch(url)
      const data = await res.json()
      dlog('[materials:list] raw response', data)
      const list = data?.items || data?.sets || data?.data?.items || []
      dlog('[materials:list] using items length:', list.length)
      if (list[0]) {
        dlog('[materials:list] first item sample', {
          id: list[0].id,
          segments: list[0].segments,
          segmentsCount: list[0].segmentsCount,
          pagesCount: list[0].pagesCount,
          filesCount: list[0].filesCount,
          totalPages: list[0].totalPages,
          ready: list[0].ready,
          active: list[0].active,
        })
      }
      setItems(list)
      setSetInfo(data?.data?.set || null)
    } catch (e) {
      dlog('[materials:list] error', e)
      setMsg('Kon lijst niet ophalen')
    } finally { setLoading(false) }
  }
  useEffect(() => { refresh() }, [vak, leerjaar, hoofdstuk])

  const onUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!(/(\.pdf|\.docx)$/i).test(file.name)) { alert('Alleen .pdf of .docx toegestaan'); e.target.value = ''; return }
    if (file.size > 10 * 1024 * 1024) { alert('Bestand te groot (max 10MB)'); e.target.value = ''; return }
    setUploading(true); setMsg('Bezig met verwerken…')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('vak', vak)
      fd.append('leerjaar', leerjaar)
      fd.append('hoofdstuk', hoofdstuk)
      fd.append('subject', vak)
      fd.append('grade', leerjaar)
      fd.append('chapter', hoofdstuk)
      fd.append('uploader', 'docent')
      const res = await apiFetch('/api/materials/upload', { method: 'POST', body: fd })
      const data = await res.json()
      dlog('[materials:upload] raw response', data)
      if (!res.ok || data?.ok === false) throw new Error(data?.message || data?.error || 'Upload mislukt')
      const m = data?.material || data?.data?.item || {}
      const segCount = m.segmentsCount ?? m.pagesCount ?? m.segments ?? data?.data?.segmentCount ?? 0
      dlog('[materials:upload] computed segCount from', { segments: m.segments, segmentsCount: m.segmentsCount, pagesCount: m.pagesCount, fallback: data?.data?.segmentCount })
      setMsg(`Gereed: ${segCount} segmenten`)
      await refresh()
    } catch (e) { setMsg(e.message) } finally { setUploading(false); try { e.target.value = '' } catch {} }
  }

  const onActivate = async () => {
    try {
      const target = items[0]
      dlog('[materials:activate] using target', target?.id)
      const body = target?.id ? { material_id: target.id } : { vak, leerjaar, hoofdstuk }
      const res = await apiFetch('/api/materials/activate', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      dlog('[materials:activate] raw response', data)
      if (!res.ok || data?.ok === false) throw new Error(data?.message || data?.error || 'Activeren mislukt')
      setMsg('Actief gemaakt')
      await refresh()
    } catch (e) { setMsg(e.message) }
  }

  const onDelete = async (id) => {
    if (!confirm('Weet je zeker dat je dit item wilt verwijderen?')) return
    try {
      const res = await apiFetch(`/api/materials/item?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      const data = await res.json()
      dlog('[materials:delete] raw response', data)
      if (!res.ok || data?.ok === false) throw new Error(data?.message || data?.error || 'Verwijderen mislukt')
      await refresh()
    } catch (e) { setMsg(e.message) }
  }

  const onPreview = async (id) => {
    try {
      const res = await apiFetch(`/api/materials/preview?material_id=${encodeURIComponent(id)}`)
      const data = await res.json()
      dlog('[materials:preview] raw response', data)
      if (!res.ok || data?.ok === false) throw new Error(data?.message || data?.error || 'Preview mislukt')
      const text = data?.preview?.textSnippet || data?.data?.preview || ''
      alert((text || 'Geen preview beschikbaar').slice(0, 1200))
    } catch (e) { alert(e.message) }
  }

  const onSeed = async () => {
    if (!seedText.trim()) { alert('Plak eerst tekst'); return }
    setLoading(true); setMsg('Bezig met seeden…')
    try {
      const res = await apiFetch('/api/materials/seed-text', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vak, leerjaar, hoofdstuk, text: seedText }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Seed mislukt')
      const segCount = data?.data?.segmentCount ?? 0
      setMsg(`Seed opgeslagen: ${segCount} segmenten`)
      setSeedText('')
      await refresh()
    } catch (e) { setMsg(e.message) } finally { setLoading(false) }
  }

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center gap-2"><h4 className="text-base font-bold">Lesmateriaal beheren</h4></div>
      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <select value={vak} onChange={(e) => setVak(e.target.value)} className="rounded-md bg-purple-50 p-2">{SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}</select>
        <select value={leerjaar} onChange={(e) => setLeerjaar(e.target.value)} className="rounded-md bg-purple-50 p-2">{YEARS.map((y) => <option key={y} value={y}>{y}</option>)}</select>
        <select value={hoofdstuk} onChange={(e) => setHoofdstuk(e.target.value)} className="rounded-md bg-purple-50 p-2">{['1'].map((h) => <option key={h} value={h}>{h}</option>)}</select>
      </div>
      <div className="mb-2 flex items-center gap-2">
        <label className="cursor-pointer rounded-xl bg-white px-4 py-2 font-semibold text-purple-700 hover:bg-purple-100">Upload lesmateriaal (PDF of DOCX)
          <input type="file" className="hidden" accept=".pdf,.docx" onChange={onUpload} disabled={uploading} />
        </label>
        <button onClick={onActivate} className="rounded-xl bg-white px-4 py-2 font-semibold text-purple-700 hover:bg-purple-100" disabled={uploading || loading}>Activeer set</button>
      </div>
      {msg && <p className="text-sm text-purple-900">{msg}</p>}

      <div className="mt-3 rounded-xl bg-purple-50 p-3 text-purple-900">
        <p className="mb-2 text-sm font-semibold">Snel testen (plak tekst)</p>
        <textarea value={seedText} onChange={(e) => setSeedText(e.target.value)} placeholder="Plak hier een stuk tekst uit je PDF (90KB of kleiner is prima)." className="h-28 w-full resize-y rounded-md border border-purple-200 bg-white p-2 text-sm outline-none focus:ring-2 focus:ring-purple-300" />
        <div className="mt-2 flex justify-end"><button onClick={onSeed} disabled={loading || !seedText.trim()} className="rounded-md bg-purple-600 px-3 py-1 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60">Opslaan als seed</button></div>
      </div>

      <div className="mt-3 rounded-xl bg-purple-50 p-3 text-purple-900">
        <div className="mb-2 flex items-center justify-between"><span className="text-sm font-semibold">Uploads</span>{loading && <span className="text-xs">Laden…</span>}</div>
        <div className="space-y-2">
          {items.length === 0 && <p className="text-sm">Nog geen uploads.</p>}
          {items.map((it) => (
            <div key={it.id} className="flex flex-wrap items-center justify-between rounded-md bg-white p-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{it.filename}</p>
                <p className="text-xs text-purple-600">Status: {it.status} • Type: {it.type} • {new Date(it.createdAt).toLocaleString()}</p>
                <p className="text-xs text-purple-600">Vak: {it.subject || it.vak || '-'} • Leerjaar: {it.grade || it.leerjaar || '-'} • Hoofdstuk: {it.chapter || it.hoofdstuk || '-'}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => onPreview(it.id)} className="rounded-md bg-purple-100 px-2 py-1 text-xs font-semibold text-purple-700 hover:bg-purple-200">Bekijken</button>
                <button onClick={() => onDelete(it.id)} className="rounded-md bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-200">Verwijderen</button>
              </div>
            </div>
          ))}
        </div>
        {setInfo && (<p className="mt-2 text-xs">Set actief: {setInfo.active ? 'Ja' : 'Nee'}</p>)}
      </div>
    </div>
  )
}

function ChatPanel({ mode, context }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showTyping, setShowTyping] = useState(false)
  const listRef = useRef(null)
  const { fetchGlossary } = useGlossary()
  const GLOSSARY_ENABLED = process.env.NEXT_PUBLIC_GLOSSARY_ENABLED === 'true'
  
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    if (typeof el.scrollTo === 'function') el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    else el.scrollTop = el.scrollHeight
  }, [messages])

  // Fetch glossary when context changes (optional)
  useEffect(() => {
    if (GLOSSARY_ENABLED && context.vak && context.leerjaar && context.hoofdstuk) {
      fetchGlossary(context.vak, context.leerjaar, context.hoofdstuk)
    }
  }, [GLOSSARY_ENABLED, context.vak, context.leerjaar, context.hoofdstuk, fetchGlossary])

  useEffect(() => {
    setMessages([])
    if (mode === 'Leren') {
      setMessages([{ role: 'assistant', content: 'Laten we beginnen met leren! Wat weet je al over dit hoofdstuk?' }])
    }
    if (mode === 'Overhoren') {
      setMessages([{ role: 'assistant', content: 'We gaan je overhoren. Klaar voor vraag 1? Zeg bijvoorbeeld: "Start".' }])
    }
  }, [mode])

  useEffect(() => {
    let t
    if (loading) { t = setTimeout(() => setShowTyping(true), 400) } else { setShowTyping(false) }
    return () => { if (t) clearTimeout(t) }
  }, [loading])

  const send = async () => {
    if (!input.trim()) return
    const next = [...messages, { role: 'user', content: input }]
    setMessages(next); setInput(''); setLoading(true)
    try {
      const llm = getLLMClient()
      const topicId = `${context.vak || 'Onderwerp'}-${context.hoofdstuk || '1'}`
      if (mode === 'Overhoren') {
        // For now, reuse hints flow but ensure context is sent; quiz flow can be plugged later
        const res = await llm.generateHints({ topicId, text: input, subject: context.vak, grade: context.leerjaar, chapter: context.hoofdstuk })
        const content = [res.tutor_message, res.follow_up_question].filter(Boolean).join('\n')
        const firstHint = res.hints && res.hints.length > 0 ? res.hints[0] : null
        setMessages((m) => [...m, { role: 'assistant', content: content || '...', hint: firstHint }])
      } else {
        const { tutor_message, hints, follow_up_question, notice } = await llm.generateHints({ topicId, text: input, subject: context.vak, grade: context.leerjaar, chapter: context.hoofdstuk })
        const content = [notice ? `(${notice})` : null, tutor_message, follow_up_question].filter(Boolean).join('\n')
        const firstHint = hints && hints.length > 0 ? hints[0] : null
        setMessages((m) => [...m, { role: 'assistant', content: content || '...', hint: firstHint }])
      }
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: 'Er ging iets mis. Probeer het later nog eens.' }])
    } finally { setLoading(false) }
  }

  const loadingLabel = mode === 'Oefentoets' ? 'Oefentoets klaarzetten' : 'Assistant is bezig'

  return (
    <div className="mx-auto mt-2 w-full max-w-3xl rounded-2xl bg-white/10 p-4 ring-1 ring-white/20">
      <div ref={listRef} className="max-h-[50vh] space-y-4 overflow-auto p-2">
        {messages.map((m, idx) => {
          // Helper function to limit hint to one sentence
          const limitToOneSentence = (text) => {
            if (!text) return text
            const match = text.match(/^[^.!?]*[.!?]/)
            return match ? match[0].trim() : text.trim()
          }
          
          const limitedHint = limitToOneSentence(m.hint)
          
          return (
            <div key={idx} className={`flex items-start gap-3 ${m.role === 'assistant' ? '' : 'justify-end'}`}>
              <div className={`relative max-w-[80%] rounded-xl px-4 py-3 text-base leading-relaxed ${m.role === 'assistant' ? 'bg-white/15 text-white' : 'bg-white text-purple-800'}`} style={{ wordBreak: 'break-word' }}>
                <div className="max-w-[70ch] whitespace-pre-wrap">
                  <ProcessedText>{m.content}</ProcessedText>
                </div>
              </div>
              {m.role === 'assistant' && limitedHint && (
                <div className="flex flex-col items-center gap-1 mt-1">
                  <HintBubble hint={limitedHint} />
                  <span className="text-xs text-white/70 font-medium">Hint</span>
                </div>
              )}
            </div>
          )
        })}
        {showTyping && (
          <div className="max-w-[85%] rounded-xl px-4 py-3 text-base leading-relaxed bg-white/15 text-white">
            <span className="typing-dots" aria-live="polite" aria-label={loadingLabel}>
              <span className="dot"></span>
              <span className="dot"></span>
              <span className="dot"></span>
            </span>
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} placeholder={mode === 'Overhoren' ? 'Typ je antwoord…' : 'Stel je vraag…'} className="h-20 flex-1 resize-none rounded-xl border border-white/20 bg-white/90 p-3 text-purple-800 outline-none placeholder:text-purple-300 focus:ring-2 focus:ring-purple-300" />
        <button onClick={send} className="h-20 rounded-xl bg-white px-4 font-semibold text-purple-700 hover:bg-purple-100">Sturen</button>
      </div>
    </div>
  )
}

function OefentoetsPanel({ context }) {
  const [num, setNum] = useState(5)
  const [items, setItems] = useState([])
  const [answers, setAnswers] = useState({})
  const [examId, setExamId] = useState(null)
  const [phase, setPhase] = useState('choose') // choose | take | report
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)

  const llm = getLLMClient()

  const startExam = async () => {
    setLoading(true)
    try {
      const topicId = `${context.vak || 'Onderwerp'}-${context.hoofdstuk || '1'}`
      const res = await llm.generateExam({ topicId, totalQuestions: num, subject: context.vak, grade: context.leerjaar, chapter: context.hoofdstuk })
      const q = Array.isArray(res.questions) ? res.questions : []
      setItems(q.map((it, idx) => ({ idx: idx + 1, question: it.stem || it.question || '' })))
      setExamId(res.exam_id || null)
      setPhase('take')
    } catch (e) { alert('Oefentoets genereren mislukt.'); } finally { setLoading(false) }
  }

  const submitExam = async () => {
    setLoading(true)
    try {
      const answersArr = items.map((it) => ({ idx: it.idx, question: it.question, answer: answers[it.idx] || '' }))
      const res = await llm.submitExam({ answers: answersArr, subject: context.vak, grade: context.leerjaar, chapter: context.hoofdstuk })
      if (!res || res.ok === false) throw new Error(res?.message || 'Nakijken mislukt')
      setReport(res)
      setPhase('report')
    } catch (e) { alert(e.message || 'Nakijken mislukt'); } finally { setLoading(false) }
  }

  if (phase === 'choose') {
    return (
      <div className="mx-auto mt-2 w-full max-w-3xl rounded-2xl bg-white/10 p-6 ring-1 ring-white/20">
        <p className="mb-3 text-center text-white/90">Kies het aantal vragen en start de oefentoets.</p>
        <div className="mb-4 flex justify-center gap-3">
          <button className={`rounded-full px-4 py-2 ${num === 5 ? 'bg-white text-purple-700' : 'bg-white/10 text-white border border-white/30'}`} onClick={() => setNum(5)}>5 vragen</button>
          <button className={`rounded-full px-4 py-2 ${num === 10 ? 'bg-white text-purple-700' : 'bg-white/10 text-white border border-white/30'}`} onClick={() => setNum(10)}>10 vragen</button>
        </div>
        <div className="flex justify-center">
          <button 
            onClick={startExam} 
            disabled={loading} 
            className={`rounded-xl px-6 py-2 font-semibold transition-colors ${
              loading 
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                : 'bg-white text-purple-700 hover:bg-purple-100'
            }`}
          >
            {loading ? 'Oefentoets maken...' : 'Start oefentoets'}
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'take') {
    return (
      <div className="mx-auto mt-2 w-full max-w-3xl space-y-4">
        {/* Header with success message */}
        <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/20">
          <div className="flex items-center gap-2 text-white">
            <span className="text-green-400">🟢</span>
            <span className="text-sm">Oefentoets gestart. Succes!</span>
          </div>
        </div>
        
        {/* Questions Container */}
        <div className="rounded-2xl bg-gradient-to-br from-purple-600 to-purple-800 p-6 text-white">
          <div className="space-y-6">
            {items.map((it, index) => (
              <div key={it.idx} className="space-y-3">
                <p className="text-lg font-medium text-white">
                  Vraag {it.idx}: {it.question}
                </p>
                <textarea 
                  value={answers[it.idx] || ''} 
                  onChange={(e) => setAnswers((a) => ({ ...a, [it.idx]: e.target.value }))} 
                  placeholder="Jouw antwoord..." 
                  className="w-full h-20 rounded-xl border-0 bg-white/90 p-4 text-purple-800 placeholder:text-purple-400 focus:ring-2 focus:ring-purple-300 outline-none resize-none" 
                />
              </div>
            ))}
          </div>
          
          <div className="mt-6 flex justify-center">
            <button 
              onClick={submitExam} 
              disabled={loading} 
              className={`rounded-xl px-8 py-3 font-semibold transition-colors ${
                loading 
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                  : 'bg-white text-purple-700 hover:bg-purple-50'
              }`}
            >
              {loading ? 'Oefentoets nakijken...' : 'Inleveren'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'report' && report) {
    const s = report.score || { percentage: 0, correct: 0, partial: 0, wrong: 0, total: 0 }
    
    // Dynamic qualification sentence based on percentage
    const getQualificationText = (percentage) => {
      if (percentage >= 90) return "Uitstekend resultaat — je beheerst dit onderwerp bijna volledig!"
      if (percentage >= 70) return "Sterk gedaan — nog wat puntjes om te verfijnen."
      if (percentage >= 40) return "Goed op weg, met nog ruimte voor groei."
      return "Er is nog veel te winnen — dit is een mooi startpunt!"
    }
    
    return (
      <div className="mx-auto mt-2 w-full max-w-3xl space-y-4">
        {/* Toetsrapport Header */}
        <div className="rounded-2xl bg-white p-6 text-purple-900 shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🎓</span>
            <h3 className="text-2xl font-bold">Toetsrapport</h3>
          </div>
          
          {/* Score Summary */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">📊</span>
              <span className="font-semibold">Score: {s.correct}/{s.total} ({s.percentage}%)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg">🎯</span>
              <span className="font-semibold">Cijfer: {(s.percentage / 10).toFixed(1)}</span>
            </div>
          </div>
          
          {/* Dynamic Qualification */}
          <div className="mb-4">
            <p className="text-purple-700 font-medium">{getQualificationText(s.percentage)}</p>
          </div>
          
          {/* Simple Recommendations */}
          <div className="space-y-2 mb-4">
            <div className="flex items-start gap-2">
              <span>✨</span>
              <div>
                <span className="font-semibold text-purple-800">Sterk:</span>
                <span className="text-purple-700 ml-1">Je antwoorden zijn vaak duidelijk en op de juiste lijn.</span>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span>📌</span>
              <div>
                <span className="font-semibold text-purple-800">Verbeterpunt:</span>
                <span className="text-purple-700 ml-1">Probeer de begrippen expliciet te noemen.</span>
              </div>
            </div>
          </div>
          
          {/* Overall Feedback */}
          <div className="rounded-lg bg-purple-50 p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-green-600">✅</span>
              <span className="font-semibold text-purple-800">
                Ingeleverd! Je score: {s.correct}/{s.total} ({s.percentage}%). Cijfer: {(s.percentage / 10).toFixed(1)}.
              </span>
            </div>
            <p className="text-purple-700">
              Je hebt {s.correct} van de {s.total} vragen goed beantwoord. Goed werk!
            </p>
          </div>
          
          {/* General Feedback */}
          {report.summary && (
            <div className="text-purple-700">
              <p className="font-semibold mb-2">Aanbevelingen:</p>
              <p className="text-sm">{report.summary}</p>
            </div>
          )}
        </div>
        
        {/* Question Details */}
        <div className="space-y-3">
          {Array.isArray(report.feedback) && report.feedback.map((fb, i) => (
            <details key={i} className="group rounded-xl bg-white shadow-md">
              <summary className="flex cursor-pointer list-none items-center justify-between p-4 hover:bg-purple-50 rounded-xl">
                <span className="flex items-center gap-3 font-semibold text-purple-900">
                  <span className="text-lg">{fb.emoji || '❔'}</span>
                  <span>Vraag {i + 1}</span>
                </span>
                <svg className="w-5 h-5 text-purple-500 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="px-4 pb-4 space-y-3 text-sm text-purple-800">
                <div className="border-t border-purple-100 pt-3">
                  <p><span className="font-semibold">Vraag:</span> {fb.question}</p>
                </div>
                <p><span className="font-semibold">Jouw antwoord:</span> {fb.studentAnswer || '(leeg)'}</p>
                <div className="rounded-lg bg-orange-50 p-3">
                  <p><span className="font-semibold text-orange-800">⭐ Uitleg:</span> <span className="text-orange-700">{fb.explanation}</span></p>
                </div>
                <div className="rounded-lg bg-blue-50 p-3">
                  <p><span className="font-semibold text-blue-800">⭐ Modelantwoord:</span> <span className="text-blue-700">{fb.modelAnswer}</span></p>
                </div>
              </div>
            </details>
          ))}
        </div>
        
        {/* Action Button */}
        <div className="flex justify-center pt-2">
          <button 
            onClick={() => { setPhase('choose'); setItems([]); setAnswers({}); setReport(null) }} 
            className="rounded-xl bg-purple-600 px-6 py-3 font-semibold text-white hover:bg-purple-700 transition-colors"
          >
            Nieuwe toets
          </button>
        </div>
      </div>
    )
  }

  return null
}

function Workspace({ context, mode, setMode, setModeFromCTA, guidance }) {
  return (
    <div className="container mx-auto mt-2">
      <div className="mb-2 w-full flex flex-wrap items-center justify-center gap-2 text-center">
        <Chip>Vak: {context.vak}</Chip>
        <Chip>Leerjaar: {context.leerjaar}</Chip>
        <Chip>Hoofdstuk: {context.hoofdstuk}</Chip>
      </div>
      <Card>
        <p className="mb-4 text-lg">Hoe wil je vandaag oefenen?</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FullButton size="mode" onClick={() => setMode('Leren')}>Leren</FullButton>
          <FullButton size="mode" onClick={() => setMode('Overhoren')}>Overhoren</FullButton>
          <FullButton size="mode" onClick={() => setMode('Oefentoets')}>Oefentoets</FullButton>
        </div>
      </Card>

      {mode === 'Leren' && <ChatPanel mode={mode} context={context} />}
      {mode === 'Overhoren' && <ChatPanel mode={mode} context={context} />}
      {mode === 'Oefentoets' && (
        <OefentoetsPanel context={context} />
      )}
    </div>
  )
}

function AppInner() {
  const [guidance, setGuidance] = useLocalStorage('studiebot.guidance', defaultGuidance)
  const [isTeacher, setIsTeacher] = useLocalStorage('studiebot.isTeacher', false)
  const [step, setStep] = useState(0)
  const [vak, setVak] = useState('')
  const [leerjaar, setLeerjaar] = useState('')
  const [hoofdstuk, setHoofdstuk] = useState('')
  const [mode, setMode] = useState(null)

  const context = useMemo(() => ({ vak, leerjaar, hoofdstuk }), [vak, leerjaar, hoofdstuk])
  const setModeFromCTA = (nextMode) => { setMode(nextMode) }

  return (
    <div className="min-h-screen py-2">
      <HeaderBar step={step} setStep={setStep} />
      <LLMNotice />
      <HeaderConfig guidance={guidance} setGuidance={setGuidance} isTeacher={isTeacher} setIsTeacher={setIsTeacher} />
      <div className="container mx-auto flex min-h-[70vh] flex-col items-center justify-center text-center">
        <FadeSlide show={step === 0}>
          {step === 0 && (
            <div className="space-y-6">
              <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Welkom bij Studiebot</h1>
              <p className="text-lg text-white/90">Waar wil je vandaag mee aan de slag?</p>
              <Card>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {SUBJECTS.map((s) => (
                    <FullButton key={s} onClick={() => { setVak(s); setStep(1) }}>{s}</FullButton>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </FadeSlide>

        <FadeSlide show={step === 1}>
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-3xl font-bold">In welk leerjaar zit je?</h2>
              <Card>
                <div className="flex flex-col gap-3">
                  {YEARS.map((y) => (
                    <FullButton key={y} size="compact" onClick={() => { setLeerjaar(y); setStep(2) }}>Leerjaar {y}</FullButton>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </FadeSlide>

        <FadeSlide show={step === 2}>
          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-3xl font-bold">Welk hoofdstuk wil je oefenen?</h2>
              <Card>
                <div className="grid grid-cols-1 gap-3">
                  {['1'].map((h) => (
                    <FullButton key={h} onClick={() => { setHoofdstuk(h); setStep(3) }}>Hoofdstuk {h}</FullButton>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </FadeSlide>

        <FadeSlide show={step === 3}>
          {step === 3 && (
            <div className="w-full">
              <Workspace context={context} mode={mode} setMode={setMode} guidance={guidance} setModeFromCTA={setModeFromCTA} />
            </div>
          )}
        </FadeSlide>
      </div>
    </div>
  )
}

function App() { 
  return (
    <EmojiModeProvider>
      <GlossaryProvider>
        <AppInner />
      </GlossaryProvider>
    </EmojiModeProvider>
  )
}
export default App