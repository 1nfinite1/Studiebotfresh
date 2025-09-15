'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

const SUBJECTS = [
  'Nederlands',
  'Engels',
  'Geschiedenis',
  'Aardrijkskunde',
  'Wiskunde',
  'Natuurkunde',
  'Scheikunde',
  'Biologie',
  'Economie',
  'Maatschijleer',
]

const YEARS = ['1', '2', '3', '4', '5', '6']

const defaultPrompts = {
  leren: `Studiebot Leren: - Werk in het Nederlands - 1 concept per keer - Leg helder uit - Pas niveau aan aan leerling - Definieer abstracte termen - Eindig ALTIJD met een relevante vraag. Neutraal bij grof taalgebruik.`,
  overhoren: `Studiebot Overhoren: - Stel toets-achtige vragen - Korte, directe feedback - Als antwoord net voldoende is, stel 1 controlevraag - Sluit af met reflectieprompt van 50 woorden. Neutraal bij grof taalgebruik.`,
  oefentoets: `Studiebot Oefentoets: - 5 of 10 vragen - Geen hulp tijdens de toets - Alleen na inleveren: per-vraag feedback, aanbevelingen en cijfer (70% ≈ 5,5; 100% = 10; 0% = 1; 1 decimaal). Vriendelijke toon, geen grade inflatie.`,
}

const Chip = ({ children }) => {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm text-white/90 ring-1 ring-white/25">
      {children}
    </span>
  )
}

const FullButton = ({ children, onClick, variant = 'primary' }) => {
  const classes =
    variant === 'secondary'
      ? 'bg-white/10 hover:bg-white/20 text-white'
      : 'bg-white text-purple-700 hover:bg-purple-100'
  return (
    <button onClick={onClick} className={`w-full rounded-xl py-4 text-lg font-semibold transition ${classes}`}>
      {children}
    </button>
  )
}

const Card = ({ children }) => {
  return (
    <div className="w-full max-w-2xl rounded-2xl bg-white/10 p-6 shadow-xl ring-1 ring-white/20 backdrop-blur">
      {children}
    </div>
  )
}

const FadeSlide = ({ show, children }) => {
  return (
    <div className={`transition-all duration-300 ${show ? 'opacity-100 translate-y-0' : 'pointer-events-none opacity-0 translate-y-3'}`}>{children}</div>
  )
}

function useLocalStorage(key, initialValue) {
  const [state, setState] = useState(() => {
    try {
      const v = localStorage.getItem(key)
      return v ? JSON.parse(v) : initialValue
    } catch {
      return initialValue
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state))
    } catch {}
  }, [key, state])
  return [state, setState]
}

function HeaderConfig({ prompts, setPrompts }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="container mx-auto mb-6 flex items-center justify-between">
      <div />
      <button onClick={() => setOpen(!open)} className="rounded-lg bg-white/15 px-3 py-2 text-sm ring-1 ring-white/25 hover:bg-white/25">
        Config
      </button>
      {open && (
        <div className="absolute left-1/2 top-20 z-50 w-[min(90vw,720px)] -translate-x-1/2 rounded-2xl bg-white p-4 text-purple-900 shadow-2xl">
          <h3 className="mb-2 text-lg font-bold">Systeem-prompts (lokaal opgeslagen)</h3>
          <div className="grid gap-3">
            {['leren', 'overhoren', 'oefentoets'].map((k) => (
              <div key={k}>
                <label className="mb-1 block text-sm font-semibold capitalize">{k}</label>
                <textarea
                  value={prompts[k]}
                  onChange={(e) => setPrompts({ ...prompts, [k]: e.target.value })}
                  className="h-24 w-full rounded-md border border-purple-200 bg-purple-50/50 p-2 text-sm outline-none ring-purple-300 focus:ring"
                />
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={() => setPrompts(defaultPrompts)}
              className="rounded-md bg-purple-100 px-3 py-1 text-sm font-semibold text-purple-700 hover:bg-purple-200"
            >
              Reset naar standaard
            </button>
            <button onClick={() => setOpen(false)} className="rounded-md bg-purple-600 px-3 py-1 text-sm font-semibold text-white hover:bg-purple-700">
              Sluiten
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ChatPanel({ mode, context, prompts }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const listRef = useRef(null)
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  // Reset messages when mode changes
  useEffect(() => {
    setMessages([])
    if (mode === 'Leren') {
      setMessages([{ role: 'assistant', content: 'Laten we beginnen met leren. Wat vind je lastig binnen dit hoofdstuk?' }])
    }
    if (mode === 'Overhoren') {
      setMessages([{ role: 'assistant', content: 'We gaan je overhoren. Klaar voor vraag 1? Zeg bijvoorbeeld: "Start".' }])
    }
  }, [mode])

  const send = async () => {
    if (!input.trim()) return
    const next = [...messages, { role: 'user', content: input }]
    setMessages(next)
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next,
          mode,
          vak: context.vak,
          leerjaar: context.leerjaar,
          hoofdstuk: context.hoofdstuk,
          systemPrompt: prompts?.[mode?.toLowerCase?.()] || '',
        }),
      })
      const data = await res.json()
      setMessages((m) => [...m, { role: 'assistant', content: data?.message || '...' }])
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: 'Er ging iets mis. Probeer het later nog eens.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto mt-4 w-full max-w-3xl rounded-2xl bg-white/10 p-4 ring-1 ring-white/20">
      <div ref={listRef} className="max-h-[50vh] space-y-3 overflow-auto p-2">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`max-w-[85%] rounded-xl px-4 py-2 text-sm ${
              m.role === 'assistant' ? 'bg-white/20 text-white' : 'ml-auto bg-white text-purple-700'
            }`}
          >
            {m.content}
          </div>
        ))}
        {loading && <div className="text-sm text-white/80">Antwoord wordt gegenereerd…</div>}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)
          placeholder={mode === 'Overhoren' ? 'Typ je antwoord…' : 'Stel je vraag…'}
          className="h-20 flex-1 resize-none rounded-xl border border-white/20 bg-white/90 p-3 text-purple-800 outline-none placeholder:text-purple-300 focus:ring-2 focus:ring-purple-300"
        />
        <button onClick={send} className="h-20 rounded-xl bg-white px-4 font-semibold text-purple-700 hover:bg-purple-100">
          Sturen
        </button>
      </div>
    </div>
  )
}

function OefentoetsPanel({ context, prompts, onSwitchToOverhoren }) {
  const [started, setStarted] = useState(false)
  const [count, setCount] = useState(5)
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [report, setReport] = useState(null)
  const [serverMsg, setServerMsg] = useState('')

  const start = async () => {
    setStarted(true)
    setReport(null)
    setAnswers({})
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'Oefentoets',
          vak: context.vak,
          leerjaar: context.leerjaar,
          hoofdstuk: context.hoofdstuk,
          action: 'start',
          payload: { count },
          systemPrompt: prompts?.oefentoets,
        }),
      })
      const data = await res.json()
      setQuestions(data?.data?.questions || [])
      setServerMsg(data?.message || '')
    } catch (e) {
      setServerMsg('Kon de oefentoets niet starten. Probeer opnieuw.')
    }
  }

  const submit = async () => {
    // Front-end validation: non-empty + basic completeness check
    const empty = questions.filter((q) => !answers[q.id]?.trim())
    if (empty.length > 0) {
      const ok = window.confirm(
        `Vraag ${questions.findIndex((q) => !answers[q.id]?.trim()) + 1} lijkt nog niet helemaal volledig. Weet je zeker dat je de toets wil inleveren?`
      )
      if (!ok) return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'Oefentoets',
          vak: context.vak,
          leerjaar: context.leerjaar,
          hoofdstuk: context.hoofdstuk,
          action: 'submit',
          payload: { questions, answers },
          systemPrompt: prompts?.oefentoets,
        }),
      })
      const data = await res.json()
      setServerMsg(data?.message || '')
      setReport(data?.data?.report || null)
    } catch (e) {
      setServerMsg('Inleveren mislukt. Probeer opnieuw.')
    } finally {
      setSubmitting(false)
    }
  }

  const wrongFocus = useMemo(() => {
    return report?.wrongConcepts?.length ? Array.from(new Set(report.wrongConcepts)).slice(0, 3) : []
  }, [report])

  return (
    <div className="mx-auto mt-4 w-full max-w-3xl rounded-2xl bg-white/10 p-4 ring-1 ring-white/20">
      {!started && (
        <div className="space-y-3">
          <p className="text-white/90">Kies het aantal vragen en start de oefentoets.</p>
          <div className="flex gap-2">
            {[5, 10].map((n) => (
              <button
                key={n}
                onClick={() => setCount(n)}
                className={`rounded-xl px-4 py-2 font-semibold ring-1 ring-white/30 ${
                  count === n ? 'bg-white text-purple-700' : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {n} vragen
              </button>
            ))}
          </div>
          <button onClick={start} className="w-full rounded-xl bg-white py-3 font-semibold text-purple-700 hover:bg-purple-100">
            Start oefentoets
          </button>
        </div>
      )}

      {started && !report && (
        <div className="space-y-4">
          {serverMsg && <p className="text-white/80">{serverMsg}</p>}
          {questions.map((q, idx) => (
            <div key={q.id} className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
              <p className="mb-2 font-semibold text-white">{q.text}</p>
              <textarea
                value={answers[q.id] || ''}
                onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                className="h-24 w-full resize-none rounded-lg border border-white/20 bg-white/90 p-2 text-purple-800 outline-none focus:ring-2 focus:ring-purple-300"
                placeholder="Jouw antwoord…"
              />
            </div>
          ))}
          <button onClick={submit} disabled={submitting} className="w-full rounded-xl bg-white py-3 font-semibold text-purple-700 hover:bg-purple-100 disabled:opacity-60">
            {submitting ? 'Bezig met nakijken…' : 'Inleveren'}
          </button>
        </div>
      )}

      {report && (
        <div className="space-y-4">
          <p className="text-white">{serverMsg}</p>
          <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
            <p className="mb-2 font-semibold">Overzicht</p>
            <p>Score: {report.correctCount}/{report.total} ({report.pct}%)</p>
            <p>Cijfer: {report.grade.toFixed(1)}</p>
          </div>
          <div className="space-y-3">
            {report.results.map((r, i) => (
              <div key={r.id} className={`rounded-xl p-3 ring-1 ${r.correct ? 'bg-emerald-500/15 ring-emerald-500/30' : 'bg-rose-500/15 ring-rose-500/30'}`}>
                <p className="font-semibold">{r.text}</p>
                <p className="text-white/90">{r.feedback}</p>
              </div>
            ))}
          </div>
          {wrongFocus.length > 0 && (
            <button
              onClick={() => onSwitchToOverhoren(wrongFocus)}
              className="w-full rounded-xl bg-white py-3 font-semibold text-purple-700 hover:bg-purple-100"
            >
              Oefen nu met Overhoren op je fouten
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function Workspace({ context, mode, setMode, prompts, setModeFromCTA }) {
  return (
    <div className="container mx-auto mt-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Chip>Vak: {context.vak}</Chip>
        <Chip>Leerjaar: {context.leerjaar}</Chip>
        <Chip>Hoofdstuk: {context.hoofdstuk}</Chip>
      </div>
      <Card>
        <p className="mb-4 text-lg">Hoe wil je vandaag oefenen?</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FullButton onClick={() => setMode('Leren')}>Leren</FullButton>
          <FullButton onClick={() => setMode('Overhoren')}>Overhoren</FullButton>
          <FullButton onClick={() => setMode('Oefentoets')}>Oefentoets</FullButton>
        </div>
      </Card>

      {mode === 'Leren' && <ChatPanel mode={mode} context={context} prompts={prompts} />}
      {mode === 'Overhoren' && <ChatPanel mode={mode} context={context} prompts={prompts} />}
      {mode === 'Oefentoets' && (
        <OefentoetsPanel
          context={context}
          prompts={prompts}
          onSwitchToOverhoren={(focus) => setModeFromCTA('Overhoren', focus)}
        />
      )}
    </div>
  )
}

function AppInner() {
  const [prompts, setPrompts] = useLocalStorage('studiebot.prompts', defaultPrompts)

  const [step, setStep] = useState(0) // 0 landing, 1 leerjaar, 2 hoofdstuk, 3 workspace
  const [vak, setVak] = useState('')
  const [leerjaar, setLeerjaar] = useState('')
  const [hoofdstuk, setHoofdstuk] = useState('')
  const [mode, setMode] = useState(null)

  const context = useMemo(() => ({ vak, leerjaar, hoofdstuk }), [vak, leerjaar, hoofdstuk])

  // Handle CTA from Oefentoets
  const setModeFromCTA = (nextMode, focus = []) => {
    setMode(nextMode)
    // Optionally: in a full version we'd seed the chat with focus topics
  }

  return (
    <div className="min-h-screen py-8">
      <HeaderConfig prompts={prompts} setPrompts={setPrompts} />
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
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {YEARS.map((y) => (
                    <FullButton key={y} onClick={() => { setLeerjaar(y); setStep(2) }}>Leerjaar {y}</FullButton>
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
              <Workspace context={context} mode={mode} setMode={setMode} prompts={prompts} setModeFromCTA={setModeFromCTA} />
            </div>
          )}
        </FadeSlide>
      </div>
    </div>
  )
}

function App() {
  return <AppInner />
}

export default App