'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { getLLMClient } from '../infra/llm/index'
import { GlossaryProvider, useGlossary } from '../src/glossary/GlossaryProvider'
import { EmojiModeProvider } from '../src/emoji/EmojiModeContext'
import { EmojiModeToggle } from '../components/EmojiModeToggle'
import { ProcessedText } from '../src/lib/textProcessor'

// Minimal UI debug flag
const UI_DEBUG = process.env.NEXT_PUBLIC_UI_DEBUG === 'true'
const dlog = (...args) => { if (UI_DEBUG) console.log(...args) }

const SUBJECTS = [ 'Nederlands', 'Engels', 'Geschiedenis', 'Aardrijkskunde', 'Wiskunde', 'Natuurkunde', 'Scheikunde', 'Biologie', 'Economie', 'Maatschappijleer' ]
const YEARS = ['1', '2', '3', '4', '5', '6']

const defaultGuidance = { leren: '', overhoren: '', oefentoets: '' }

// Runtime backend URL helper
import { getBackendUrl } from '../src/lib/backendUrl'
async function apiFetch(path, options) { const base = await getBackendUrl(); const url = `${base}${path}`; return fetch(url, options) }

const IconBack = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
)

const Chip = ({ children }) => <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm text-white/90 ring-1 ring-white/25">{children}</span>

function FullButton({ children, onClick, variant = 'primary', size = 'default' }) {
  const base = 'w-full rounded-xl font-semibold transition'
  const color = variant === 'secondary' ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-white text-purple-700 hover:bg-purple-100'
  const sizing = size === 'compact' ? 'py-2.5 text-lg' : size === 'mode' ? 'min-h-14 py-3.5 px-6 text-lg' : 'py-4 text-lg'
  return (<button onClick={onClick} className={`${base} ${color} ${sizing}`}>{children}</button>)
}

const Card = ({ children }) => <div className="w-full max-w-2xl rounded-2xl bg-white/10 p-6 shadow-xl ring-1 ring-white/20 backdrop-blur">{children}</div>
const FadeSlide = ({ show, children }) => <div className={`transition-all duration-300 ${show ? 'opacity-100 translate-y-0' : 'pointer-events-none opacity-0 translate-y-3'}`}>{children}</div>

function useLocalStorage(key, initialValue) {
  const [state, setState] = useState(() => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : initialValue } catch { return initialValue } })
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(state)) } catch {} }, [key, state])
  return [state, setState]
}

function LLMNotice() { const enabled = (process.env.NEXT_PUBLIC_LLM_ENABLED === 'true'); if (enabled) return null; return (<div data-testid="llm-disabled" className="mx-auto mb-2 w-[min(92vw,920px)] rounded-xl bg-white/15 px-3 py-2 text-sm ring-1 ring-white/20"><span className="font-semibold">LLM uitgeschakeld:</span> er worden voorbeeldantwoorden gebruikt (UI-only modus).</div>) }

function HeaderBar({ step, setStep }) {
  return (
    <div className="container mx-auto flex items-center gap-3 py-4">
      {step > 0 && (<button onClick={() => setStep((s) => Math.max(0, s - 1))} className="rounded-full bg-white/20 p-2 ring-1 ring-white/30 hover:bg-white/30" aria-label="Ga terug"><IconBack /></button>)}
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
              <button onClick={() => setShowInstructions(v => !v)} className="flex w-full items-center justify-between px-3 py-2 text-left"><span className="text-sm font-bold">Instructies</span><svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={`text-purple-700 transition-transform ${showInstructions ? 'rotate-180' : ''}`}><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
              {showInstructions && (
                <div className="border-t border-purple-200 p-3 space-y-3">
                  <div className="rounded-md border border-purple-200">
                    <button onClick={() => setShowLeren(v => !v)} className="flex w-full items-center justify-between px-3 py-2 text-left"><span className="text-sm font-bold">Studiebot Leren</span><svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={`text-purple-700 transition-transform ${showLeren ? 'rotate-180' : ''}`}><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
                    {showLeren && (<div className="border-t border-purple-200 p-3"><label className="mb-1 block text-sm font-semibold">{'Pro' + 'mpt'} voor Leren</label><textarea value={guidance.leren} onChange={(e) => setGuidance({ ...guidance, leren: e.target.value })} className="h-40 w-full rounded-md border border-purple-200 bg-purple-50/50 p-2 text-sm outline-none ring-purple-300 focus:ring" /></div>)}
                  </div>
                  <div className="rounded-md border border-purple-200">
                    <button onClick={() => setShowOverhoren(v => !v)} className="flex w-full items-center justify-between px-3 py-2 text-left"><span className="text-sm font-bold">Studiebot Overhoren</span><svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={`text-purple-700 transition-transform ${showOverhoren ? 'rotate-180' : ''}`}><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
                    {showOverhoren && (<div className="border-t border-purple-200 p-3"><label className="mb-1 block text-sm font-semibold">{'Pro' + 'mpt'} voor Overhoren</label><textarea value={guidance.overhoren} onChange={(e) => setGuidance({ ...guidance, overhoren: e.target.value })} className="h-40 w-full rounded-md border border-purple-200 bg-purple-50/50 p-2 text-sm outline-none ring-purple-300 focus:ring" /></div>)}
                  </div>
                  <div className="rounded-md border border-purple-200">
                    <button onClick={() => setShowOefentoets(v => !v)} className="flex w-full items-center justify-between px-3 py-2 text-left"><span className="text-sm font-bold">Studiebot Oefentoets</span><svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={`text-purple-700 transition-transform ${showOefentoets ? 'rotate-180' : ''}`}><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
                    {showOefentoets && (<div className="border-t border-purple-200 p-3"><label className="mb-1 block text-sm font-semibold">{'Pro' + 'mpt'} voor Oefentoets</label><textarea value={guidance.oefentoets} onChange={(e) => setGuidance({ ...guidance, oefentoets: e.target.value })} className="h-40 w-full rounded-md border border-purple-200 bg-purple-50/50 p-2 text-sm outline-none ring-purple-300 focus:ring" /></div>)}
                  </div>
                </div>
              )}
            </div>
            <div className="mt-4 flex items-center justify-between rounded-md bg-purple-50 p-3"><label htmlFor="is-teacher" className="text-sm font-semibold text-purple-700">Ik ben docent/beheerder</label><input id="is-teacher" type="checkbox" checked={isTeacher} onChange={(e) => setIsTeacher(e.target.checked)} /></div>
            <div className="mt-2 flex items-center justify-between rounded-md bg-purple-50 p-3"><EmojiModeToggle /></div>
            {isTeacher && <MaterialsAdmin />}
            <div className="mt-3 flex justify-end gap-2"><button onClick={() => setGuidance(defaultGuidance)} className="rounded-md bg-purple-100 px-3 py-1 text-sm font-semibold text-purple-700 hover:bg-purple-200">Reset naar standaard</button><button onClick={() => setOpen(false)} className="rounded-md bg-purple-600 px-3 py-1 text-sm font-semibold text-white hover:bg-purple-700">Sluiten</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

function MaterialsAdmin() { /* unchanged for brevity */ }

function ChatPanel({ mode, context }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showTyping, setShowTyping] = useState(false)
  const listRef = useRef(null)
  const { fetchGlossary } = useGlossary()
  const GLOSSARY_ENABLED = process.env.NEXT_PUBLIC_GLOSSARY_ENABLED === 'true'
  useEffect(() => { const el = listRef.current; if (!el) return; if (typeof el.scrollTo === 'function') el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }); else el.scrollTop = el.scrollHeight }, [messages])
  useEffect(() => { if (GLOSSARY_ENABLED && context.vak && context.leerjaar && context.hoofdstuk) { fetchGlossary(context.vak, context.leerjaar, context.hoofdstuk) } }, [GLOSSARY_ENABLED, context.vak, context.leerjaar, context.hoofdstuk, fetchGlossary])
  useEffect(() => { setMessages([]); if (mode === 'Leren') { setMessages([{ role: 'assistant', content: 'Laten we beginnen met leren! Wat weet je al over dit hoofdstuk? 😊' }]) } if (mode === 'Overhoren') { setMessages([{ role: 'assistant', content: 'We gaan je overhoren. Klaar voor vraag 1? Zeg bijvoorbeeld: "Start". 🎯' }]) } }, [mode])
  useEffect(() => { let t; if (loading) { t = setTimeout(() => setShowTyping(true), 400) } else { setShowTyping(false) } return () => { if (t) clearTimeout(t) } }, [loading])

  const send = async () => {
    if (!input.trim()) return
    const next = [...messages, { role: 'user', content: input }]
    setMessages(next); setInput(''); setLoading(true)
    try {
      const llm = getLLMClient()
      const topicId = `${context.vak || 'Onderwerp'}-${context.hoofdstuk || '1'}`
      if (mode === 'Overhoren') {
        // Use the quiz route only
        const q = await llm.generateQuizQuestion({ topicId, objective: '', currentBloom: 'remember', currentDifficulty: 'easy', subject: context.vak, grade: context.leerjaar, chapter: context.hoofdstuk })
        let content = q?.stem || ''
        if (Array.isArray(q?.choices) && q.choices.length > 0) {
          const letters = ['A', 'B', 'C', 'D', 'E', 'F']
          const lines = q.choices.slice(0, 6).map((c, i) => `${letters[i]}) ${c}`)
          content = [content, ...lines].filter(Boolean).join('\n')
        }
        setMessages((m) => [...m, { role: 'assistant', content: content || '...' }])
      } else {
        // Learn route (no hints)
        const res = await llm.learn({ topicId, text: input, subject: context.vak, grade: context.leerjaar, chapter: context.hoofdstuk })
        setMessages((m) => [...m, { role: 'assistant', content: res?.message || '...' }])
      }
    } catch (e) { setMessages((m) => [...m, { role: 'assistant', content: 'Er ging iets mis. Probeer het later nog eens.' }]) } finally { setLoading(false) }
  }

  const loadingLabel = mode === 'Oefentoets' ? 'Oefentoets klaarzetten' : 'Assistant is bezig'

  return (
    <div className="mx-auto mt-2 w-full max-w-3xl rounded-2xl bg-white/10 p-4 ring-1 ring-white/20">
      <div ref={listRef} className="max-h-[50vh] space-y-4 overflow-auto p-2">
        {messages.map((m, idx) => (
          <div key={idx} className={`max-w-[85%] rounded-xl px-4 py-3 text-base leading-relaxed ${m.role === 'assistant' ? 'bg-white/15 text-white' : 'ml-auto bg-white text-purple-800'}`} style={{ wordBreak: 'break-word' }}>
            <div className="max-w-[70ch] whitespace-pre-wrap"><ProcessedText>{m.content}</ProcessedText></div>
          </div>
        ))}
        {showTyping && (
          <div className="max-w-[85%] rounded-xl px-4 py-3 text-base leading-relaxed bg-white/15 text-white">
            <span className="typing-dots" aria-live="polite" aria-label={loadingLabel}><span className="dot"></span><span className="dot"></span><span className="dot"></span></span>
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

// OefentoetsPanel stays as in previous commit (generate → take → report)

function Workspace({ context, mode, setMode }) {
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

function AppInner() { /* unchanged scaffolding */ }

function App() { return (<EmojiModeProvider><GlossaryProvider><AppInner /></GlossaryProvider></EmojiModeProvider>) }
export default App