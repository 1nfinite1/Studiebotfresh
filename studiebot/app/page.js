'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

const SUBJECTS = [ 'Nederlands', 'Engels', 'Geschiedenis', 'Aardrijkskunde', 'Wiskunde', 'Natuurkunde', 'Scheikunde', 'Biologie', 'Economie', 'Maatschappijleer' ]
const YEARS = ['1', '2', '3', '4', '5', '6']

const defaultPrompts = {
  leren: `Jij bent Studiebot, een AI-leerassistent voor het voortgezet onderwijs. Je bent gespecialiseerd in het begeleiden van leerlingen bij het verwerven van nieuwe kennis, gebaseerd op schoolboeken. Je voert een interactieve dialoog waarin je:
- Toetst wat de leerling al weet
- Stapsgewijs nieuwe stof uitlegt
- Vraagt naar begrip of laat de leerling voorbeelden geven
- Helpt de leerling zijn/haar kennis actief te structureren
Je houdt hierbij altijd rekening met het niveau, de klas en het begrip van de leerling.

Algemene instructies
- Werk gestructureerd per paragraaf. Begin elk hoofdstuk met het ophalen van voorkennis.
- Leg slechts één concept per keer uit. Gebruik korte zinnen.
- Stel regelmatig begripsvragen om te controleren of de uitleg goed is aangekomen.
- Anticipeer op misvattingen en corrigeer deze vriendelijk.
- Sluit elke paragraaf af met een kernsamenvatting in leerlingtaal.

Didactische logica
- Bij oppervlakkige of foute antwoorden: geef uitleg met een simpel voorbeeld. Stel daarna een controlevraag op herhalingsniveau.
- Bij correcte, maar summiere antwoorden: complimenteer kort, breid uit, en stel een toepassingsvraag ("Kun je een voorbeeld bedenken van…?")
- Bij sterke antwoorden: versnel de uitleg en stel inzichtsvragen ("Waarom denk je dat dit belangrijk was?" of "Wat is het verschil tussen X en Y?")
- Bij herhaalde moeite met inzichtsvragen: schakel tijdelijk terug naar reproductievragen en herhaal de kern in andere woorden.
- Eindig elk antwoord altijd met een nieuwe relevante vraag, tenzij de leerling zelf expliciet vraagt om te stoppen.
- Stel een logisch vervolg gebaseerd op de vorige uitleg óf ga door naar het volgende kernbegrip in de paragraaf.
- Gebruik geen afsluitende zinnen als "Laat het me weten" of "Wil je verder leren?". Jij bent leidend in de opbouw.
- Let op: Het klasniveau (bijv. VWO 2) is slechts een indicatie. De daadwerkelijke begeleiding moet altijd adaptief zijn.

Taalgebruik
- Spreek in duidelijke en vriendelijke leerlingentaal.
- Vermijd jargon, tenzij het woord in de lesmethode expliciet aan bod komt.
- Leg nieuwe termen uit in context, en vraag daarna of de leerling het nog weet ("Wat betekende democratie ook alweer?").
- Pas het taalniveau aan op basis van de klas (bijv. VMBO KGT = eenvoudige zinsstructuur, concrete voorbeelden, weinig vakjargon).
- Voor VMBO KGT: gebruik korte zinnen, concrete woorden en check regelmatig of de leerling je begrijpt ("Snap je wat ik bedoel met...").
- Geef bij onbekende woorden altijd een uitleg in leerlingentaal.
- Maak regelmatig gebruik van emoji's wanneer gepast om de tekst aantrekkelijk en motiverend te houden.

Interactievoorbeelden
- Leerling zegt: "Zijn de Romeinen hetzelfde als de Grieken?" → "Goede vraag! Ze lijken in sommige dingen op elkaar, zoals hun kunst en gebouwen. Maar er zijn ook grote verschillen. Weet je misschien waar de Romeinen woonden?"
- Leerling zegt: "Democratie is vrijheid." → "Dat komt in de buurt! Democratie betekent dat het volk mag meebeslissen. Kun je een voorbeeld bedenken waarbij mensen samen beslissen?"
- Leerling geeft een sterk, volledig antwoord. → "Dat leg je goed uit. Laten we nu eens kijken of je ook kunt toepassen wat je weet…"

Per paragraaf ontvang je:
- Titel van de paragraaf
- Lesdoelen (optioneel)
- Eventuele begrippenlijst
- Inhoudelijke samenvatting of tekstfragment uit de methode
Werk binnen die kaders, maar wees flexibel in tempo en aanpak. De leerling mag altijd pauzeren, samenvatten of vragen om herhaling.

Ongepast gedrag
- Ga nooit inhoudelijk in op scheldwoorden, seksuele opmerkingen of provocaties.
- Reageer altijd kort, neutraal en richting de les.
- Gebruik steeds één van deze vaste reacties, zonder variatie of afdwaling:
  - "Laten we het netjes houden, zodat ik je goed kan helpen."
  - "Dat hoort niet bij de les. Laten we doorgaan met de stof."
  - "Ik help je graag verder zodra we ons weer op de paragraaf richten."
  - "Ik ben er om je te helpen met de leerstof. Zullen we verdergaan?"
  - "Die opmerking helpt niet bij het leren. Wil je verder met de uitleg?"
- Herhaal indien nodig, zonder af te wijken of te reageren op herhaald provoceren.
- Gebruik geen dreiging, morele veroordeling of eindboodschap. Je blijft altijd beschikbaar als leerassistent, maar laat je niet afleiden of uitlokken.
- Doel: consequent terug naar de leerstof, zonder inhoudelijke reactie, zonder beloning voor storend gedrag, en zonder het gesprek ooit zelf te beëindigen.`,
  overhoren: `Studiebot Overhoren — systeemprompt (vriendelijk, flexibel & motiverend)

Identiteit & doel
- Jij bent Studiebot, een vriendelijke, motiverende AI-leerassistent voor het voortgezet onderwijs.
- In de modus Overhoren stel je toetsachtige vragen over de leerstof, beoordeel je antwoorden kort en eerlijk, en help je de leerling stap-voor-stap sterker te worden.
- Je legt niet vooraf uit; feedback volgt na elk antwoord.

Stijl & toon
- Warm, bemoedigend, menselijk.
- Begin zo mogelijk met een compliment of bevestiging, maar alleen als daar aanleiding toe is.
- Als een antwoord helemaal goed is: geef erkenning, benadruk volledigheid, en sluit vloeiend door naar de volgende vraag.
- Als een antwoord gedeeltelijk goed is: benoem het sterke punt, vul de ontbrekende kernpunten kort aan, en maak duidelijk hoe dit op een toets gewaardeerd zou worden.
- Als een antwoord onjuist is: blijf vriendelijk, benoem kort wat niet klopt of ontbreekt, en geef een herformuleerde hulpvraag of eenvoudige opvolger.
- Gebruik spaarzaam vriendelijke emoji's als ✨💪📌✅.

Feedback-aanpak (flexibel)
- Juist antwoord: korte bevestiging, eventueel extra verdiepingsvraag.
- Gedeeltelijk juist: benoem wat goed is, geef aan wat mist, schets ruwe toetswaardering ("voldoende, maar je mist nog …"), en ga door.
- Onjuist: vriendelijk corrigeren, toon 1 kernpunt van het juiste antwoord, en stel een aangepaste vervolgvraag.

Didactiek & ritme
- Na 3–5 vragen: geef een korte tussenstand ("Tot nu toe heb je X van de Y vragen goed — mooi bezig!") met 1 tip voor verbetering.
- Bij sterke antwoorden: stel verdiepende of toepassingsvragen.
- Bij zwakkere antwoorden: stel een eenvoudiger controlevraag om weer vertrouwen op te bouwen.

Overhoren na een Oefentoets
- Focus alleen op eerder fout/onvolledig beantwoorde onderdelen.
- Tempo iets hoger, maar blijf vriendelijk en motiverend.

Afsluiting Overhoren
- Als kernonderdelen voldoende beheerst zijn: "Kun je in ~50 woorden samenvatten wat je in dit hoofdstuk nu echt begrijpt?"
- Beoordeel op volledigheid, geef 1–2 complimenten en 1 tip.

Grenzen & veiligheid
- Blijf bij de leerstof, negeer provocaties of gesprekken over andere onderwerpen.
- Zeg kort en netjes: "Dat hoort niet bij de les — laten we verdergaan met de stof."

Compactheid
- Houd elk feedbackbericht onder 120 woorden.
- Combineer compliment, aanvulling en toetsindicatie flexibel — afhankelijk van het antwoord.`,
  oefentoets: `Jij bent Studiebot, een AI-leerassistent. In deze fase simuleer je een echte toets. Je biedt geen hulp tijdens het maken, maar geeft na afloop een helder, vriendelijk en eerlijk rapport.

Toetsverloop
- Stel 5 of 10 vragen, op basis van de keuze van de leerling
- Gebruik vooral open vragen (soms invul of MC waar passend)
- Zorg voor evenwichtige dekking van de leerstof binnen onderwerp/paragraaf/hoofdstuk
- Wacht tot alle antwoordvelden zijn ingevuld
- Als een veld leeg is of alleen een los woord bevat: "Vraag X lijkt nog niet helemaal volledig. Weet je zeker dat je de toets wil inleveren?"

Resultaatrapport (na inleveren)
- Feedback per vraag: beoordeel juist/onvolledig/fout; leg kort uit waarom en hoe beter; geef waar nodig een modelantwoord
- Algemene reflectie: korte samenvatting van prestaties; wat ging goed en wat knelt
- Aanbevelingen voor herhaling: wijs 2–3 begrippen/onderdelen aan om te oefenen; verwijs evt. naar Overhoren
- Rapportcijfer: schaal 1,0–10,0; 5,5 bij ±70%; 10 bij perfect; 1 bij 0 goed; rond af op één decimaal; vriendelijk afsluiten (emoji toegestaan zonder af te leiden)

Taalgebruik en stijl
- Vriendelijk, helder en toetsgericht
- Emoji’s mogen, passend en niet storend
- Stem taalgebruik af op niveau (zoals in Leren)
- Geen uitleg tijdens het maken — alleen na afloop

Ongepast gedrag
- Zelfde regels als in Leren: negeer provocaties, corrigeer neutraal, focus op toetsafhandeling
- Maak regelmatig gebruik van emoji's wanneer gepast om de tekst aantrekkelijk en motiverend te houden`,
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

function HeaderConfig({ prompts, setPrompts, isTeacher, setIsTeacher, richEmoji, setRichEmoji }) {
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
                        <label className="mb-1 block text-sm font-semibold">Prompt voor Leren</label>
                        <textarea value={prompts.leren} onChange={(e) => setPrompts({ ...prompts, leren: e.target.value })} className="h-40 w-full rounded-md border border-purple-200 bg-purple-50/50 p-2 text-sm outline-none ring-purple-300 focus:ring" />
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
                        <label className="mb-1 block text-sm font-semibold">Prompt voor Overhoren</label>
                        <textarea value={prompts.overhoren} onChange={(e) => setPrompts({ ...prompts, overhoren: e.target.value })} className="h-40 w-full rounded-md border border-purple-200 bg-purple-50/50 p-2 text-sm outline-none ring-purple-300 focus:ring" />
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
                        <label className="mb-1 block text-sm font-semibold">Prompt voor Oefentoets</label>
                        <textarea value={prompts.oefentoets} onChange={(e) => setPrompts({ ...prompts, oefentoets: e.target.value })} className="h-40 w-full rounded-md border border-purple-200 bg-purple-50/50 p-2 text-sm outline-none ring-purple-300 focus:ring" />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-md bg-purple-50 p-3">
            <label className="text-sm font-semibold text-purple-700">Ik ben docent/beheerder</label>
            <input type="checkbox" checked={isTeacher} onChange={(e) => setIsTeacher(e.target.checked)} />
          </div>

          <div className="mt-2 flex items-center justify-between rounded-md bg-purple-50 p-3">
            <label className="text-sm font-semibold text-purple-700">Rijke emoji-modus</label>
            <input type="checkbox" checked={richEmoji} onChange={(e) => setRichEmoji(e.target.checked)} />
          </div>

          {isTeacher && <MaterialsAdmin />}

          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => setPrompts(defaultPrompts)} className="rounded-md bg-purple-100 px-3 py-1 text-sm font-semibold text-purple-700 hover:bg-purple-200">Reset naar standaard</button>
            <button onClick={() => setOpen(false)} className="rounded-md bg-purple-600 px-3 py-1 text-sm font-semibold text-white hover:bg-purple-700">Sluiten</button>
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
      const res = await fetch(url)
      const data = await res.json()
      setItems(data?.data?.items || [])
      setSetInfo(data?.data?.set || null)
    } catch {
      setMsg('Kon lijst niet ophalen')
    } finally { setLoading(false) }
  }
  useEffect(() => { refresh() }, [vak, leerjaar, hoofdstuk])

  const onUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!/\.(pdf|docx)$/i.test(file.name)) { alert('Alleen .pdf of .docx toegestaan'); e.target.value = ''; return }
    if (file.size > 10 * 1024 * 1024) { alert('Bestand te groot (max 10MB)'); e.target.value = ''; return }
    setUploading(true); setMsg('Bezig met verwerken…')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('vak', vak)
      fd.append('leerjaar', leerjaar)
      fd.append('hoofdstuk', hoofdstuk)
      fd.append('uploader', 'docent')
      const res = await fetch('/api/materials/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Upload mislukt')
      const segCount = data?.data?.item?.segmentCount ?? data?.data?.segmentCount ?? 0
      setMsg(`Gereed: ${segCount} segmenten`)
      await refresh()
    } catch (e) { setMsg(e.message) } finally { setUploading(false); if (e?.target) e.target.value = '' }
  }

  const onActivate = async () => {
    try {
      const res = await fetch('/api/materials/activate', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vak, leerjaar, hoofdstuk }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Activeren mislukt')
      setMsg('Actief gemaakt')
      await refresh()
    } catch (e) { setMsg(e.message) }
  }

  const onDelete = async (id) => {
    if (!confirm('Weet je zeker dat je dit item wilt verwijderen?')) return
    try {
      const res = await fetch(`/api/materials/item?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Verwijderen mislukt')
      await refresh()
    } catch (e) { setMsg(e.message) }
  }

  const onPreview = async (id) => {
    try {
      const res = await fetch(`/api/materials/preview?id=${encodeURIComponent(id)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Preview mislukt')
      const text = Array.isArray(data?.data?.segments) ? data.data.segments.join('\n\n') : data?.data?.preview || ''
      alert((text || 'Geen preview beschikbaar').slice(0, 1200))
    } catch (e) { alert(e.message) }
  }

  const onSeed = async () => {
    if (!seedText.trim()) { alert('Plak eerst tekst'); return }
    setLoading(true); setMsg('Bezig met seeden…')
    try {
      const res = await fetch('/api/materials/seed-text', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vak, leerjaar, hoofdstuk, text: seedText }) })
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
                <p className="text-xs text-purple-600">Vak: {it.vak || '-'} • Leerjaar: {it.leerjaar || '-'} • Hoofdstuk: {it.hoofdstuk || '-'}</p>
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

function ChatPanel({ mode, context, prompts, richEmoji }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showTyping, setShowTyping] = useState(false)
  const listRef = useRef(null)
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }) }, [messages])

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

  const renderMessage = (text) => {
    const lines = String(text || '').split(/\n\n+/)
    return (
      <div className="space-y-2">
        {lines.map((block, i) => {
          const bulletLines = block.split(/\n/).filter(Boolean)
          const isList = bulletLines.every(l => l.trim().startsWith('- '))
          if (isList) {
            return (
              <ul key={i} className="list-disc pl-6 space-y-1">
                {bulletLines.map((l, j) => <li key={j}>{l.replace(/^\s*-\s*/, '')}</li>)}
              </ul>
            )
          }
          const withBold = block.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/_(.*?)_/g, '<em>$1</em>')
          return <p key={i} dangerouslySetInnerHTML={{ __html: withBold }} />
        })}
      </div>
    )
  }

  const streamLeren = async (next, sysPrompt, rich) => {
    const body = { messages: next, mode: 'Leren', vak: context.vak, leerjaar: context.leerjaar, hoofdstuk: context.hoofdstuk, systemPrompt: sysPrompt, richEmoji: rich }
    const res = await fetch('/api/chat?stream=1', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const ct = res.headers.get('content-type') || ''
    if (res.ok && ct.includes('text/plain')) {
      let acc = ''
      setMessages((m) => [...m, { role: 'assistant', content: '' }])
      const reader = res.body.getReader(); const decoder = new TextDecoder()
      while (true) { const { value, done } = await reader.read(); if (done) break; acc += decoder.decode(value); setMessages((m) => { const copy = [...m]; const idx = copy.length - 1; copy[idx] = { ...copy[idx], content: acc }; return copy }) }
      return true
    }
    return false
  }

  const send = async () => {
    if (!input.trim()) return
    const next = [...messages, { role: 'user', content: input }]
    setMessages(next); setInput(''); setLoading(true)
    try {
      if (mode === 'Leren') {
        const streamed = await streamLeren(next, prompts?.leren || '', richEmoji)
        if (streamed) { setLoading(false); return }
      }
      const body = { messages: next, mode, vak: context.vak, leerjaar: context.leerjaar, hoofdstuk: context.hoofdstuk, systemPrompt: prompts?.[mode?.toLowerCase?.()] || '', richEmoji }
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const ct = res.headers.get('content-type') || ''
      if (ct.includes('application/json')) {
        const data = await res.json()
        const msg = (data && (data.message ?? data?.data?.message)) || ''
        setMessages((m) => [...m, { role: 'assistant', content: msg || '...' }])
      } else {
        const text = await res.text()
        setMessages((m) => [...m, { role: 'assistant', content: text || '...' }])
      }
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'Er ging iets mis. Probeer het later nog eens.' }])
    } finally { setLoading(false) }
  }

  const loadingLabel = mode === 'Oefentoets' ? 'Oefentoets klaarzetten' : 'Assistant is bezig'

  return (
    <div className="mx-auto mt-2 w-full max-w-3xl rounded-2xl bg-white/10 p-4 ring-1 ring-white/20">
      <div ref={listRef} className="max-h-[50vh] space-y-4 overflow-auto p-2">
        {messages.map((m, idx) => (
          <div key={idx} className={`max-w-[85%] rounded-xl px-4 py-3 text-base leading-relaxed ${m.role === 'assistant' ? 'bg-white/15 text-white' : 'ml-auto bg-white text-purple-800'}`} style={{ wordBreak: 'break-word' }}>
            <div className="max-w-[70ch] whitespace-pre-wrap">{m.role === 'assistant' ? renderMessage(m.content) : m.content}</div>
          </div>
        ))}
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

function OefentoetsPanel({ context, prompts, onSwitchToOverhoren, richEmoji }) {
  const [started, setStarted] = useState(false)
  const [count, setCount] = useState(5)
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [report, setReport] = useState(null)
  const [serverMsg, setServerMsg] = useState('')
  const [loadingStart, setLoadingStart] = useState(false)
  const [openRows, setOpenRows] = useState({})

  const start = async () => {
    setStarted(true); setReport(null); setAnswers({}); setLoadingStart(true)
    try {
      const body = { mode: 'Oefentoets', vak: context.vak, leerjaar: context.leerjaar, hoofdstuk: context.hoofdstuk, action: 'start', payload: { count }, systemPrompt: prompts?.oefentoets, richEmoji }
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const ct = res.headers.get('content-type') || ''
      if (ct.includes('application/json')) { const data = await res.json(); setQuestions(data?.data?.questions || []); setServerMsg((data?.message ?? data?.data?.message) || '') } else { const text = await res.text(); setServerMsg(text || '') }
    } catch { setServerMsg('Kon de oefentoets niet starten. Probeer opnieuw.') } finally { setLoadingStart(false) }
  }

  const submit = async () => {
    const empty = questions.filter((q) => !answers[q.id]?.trim())
    if (empty.length > 0) { const ok = window.confirm(`Vraag ${questions.findIndex((q) => !answers[q.id]?.trim()) + 1} lijkt nog niet helemaal volledig. Weet je zeker dat je de toets wil inleveren?`); if (!ok) return }
    setSubmitting(true)
    try {
      const body = { mode: 'Oefentoets', vak: context.vak, leerjaar: context.leerjaar, hoofdstuk: context.hoofdstuk, action: 'submit', payload: { questions, answers }, systemPrompt: prompts?.oefentoets, richEmoji }
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const ct = res.headers.get('content-type') || ''
      if (ct.includes('application/json')) { const data = await res.json(); setServerMsg((data?.message ?? data?.data?.message) || ''); setReport(data?.data?.report || null) } else { const text = await res.text(); setServerMsg(text || '') }
    } catch { setServerMsg('Inleveren mislukt. Probeer opnieuw.') } finally { setSubmitting(false) }
  }

  const wrongFocus = useMemo(() => report?.wrongConcepts?.length ? Array.from(new Set(report.wrongConcepts)).slice(0, 3) : [], [report])

  return (
    <div className="mx-auto mt-2 w-full max-w-3xl rounded-2xl bg-white/10 p-4 ring-1 ring-white/20">
      {!started && (
        <div className="space-y-3">
          <p className="text-white/90">Kies het aantal vragen en start de oefentoets.</p>
          <div className="flex gap-2">{[5, 10].map((n) => (<button key={n} onClick={() => setCount(n)} className={`rounded-xl px-4 py-2 font-semibold ring-1 ring-white/30 ${count === n ? 'bg-white text-purple-700' : 'bg-white/10 text-white hover:bg-white/20'}`}>{n} vragen</button>))}</div>
          <button onClick={start} className="w-full rounded-xl bg-white py-3 font-semibold text-purple-700 hover:bg-purple-100">Start oefentoets</button>
          {loadingStart && (
            <div className="mt-2 max-w-[85%] rounded-xl px-4 py-3 text-base leading-relaxed bg-white/15 text-white">
              <span className="typing-dots" aria-live="polite" aria-label="Oefentoets wordt klaargezet">
                <span className="dot"></span>
                <span className="dot"></span>
                <span className="dot"></span>
              </span>
            </div>
          )}
        </div>
      )}

      {started && !report && (
        <div className="space-y-4">
          {serverMsg && <p className="text-white/80">{serverMsg}</p>}
          {questions.map((q) => (
            <div key={q.id} className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
              <p className="mb-2 font-semibold text-white">{q.text}</p>
              <textarea value={answers[q.id] || ''} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} className="h-24 w-full resize-none rounded-lg border border-white/20 bg-white/90 p-2 text-purple-800 outline-none focus:ring-2 focus:ring-purple-300" placeholder="Jouw antwoord…" />
            </div>
          ))}
          <button onClick={submit} disabled={submitting} className="w-full rounded-xl bg-white py-3 font-semibold text-purple-700 hover:bg-purple-100 disabled:opacity-60">{submitting ? 'Bezig met nakijken…' : 'Inleveren'}</button>
          {submitting && (
            <div className="mt-2 max-w-[85%] rounded-xl px-4 py-3 text-base leading-relaxed bg-white/15 text-white">
              <span className="typing-dots" aria-live="polite" aria-label="Antwoorden worden nagekeken">
                <span className="dot"></span>
                <span className="dot"></span>
                <span className="dot"></span>
              </span>
            </div>
          )}
        </div>
      )}

      {report && (
        <div className="space-y-4">
          {/* Bovenste samenvatting in witte bubbel */}
          <div className="rounded-xl bg-white p-4 text-purple-800 shadow ring-1 ring-purple-200">
            <div className="mb-2 flex items-center gap-2 text-lg font-semibold">
              <span className="select-none">🎓</span>
              <span>Toetsrapport</span>
            </div>
            <p className="mb-1"><span className="font-semibold">📊 Score:</span> {report.correctCount}/{report.total} ({report.pct}%)</p>
            <p className="mb-3"><span className="font-semibold">📝 Cijfer:</span> {report.grade.toFixed(1)}</p>
            {serverMsg && <p className="mb-2 whitespace-pre-wrap">{serverMsg}</p>}
            {report.summary && (
              <p className="mb-2 whitespace-pre-wrap">💡 {report.summary}</p>
            )}
            {Array.isArray(report.recommendations) && report.recommendations.length > 0 && (
              <ul className="mt-2 list-disc pl-6">
                {report.recommendations.map((r, i) => (
                  <li key={i} className="mb-1">✨ {r}</li>
                ))}
              </ul>
            )}
          </div>

          {/* Per-vraag inklapbare regels */}
          <div className="space-y-2">
            {report.results.map((r, idx) => {
              const open = !!openRows[r.id]
              const toggle = () => setOpenRows((o) => ({ ...o, [r.id]: !open }))
              const icon = r.evaluation ? (r.evaluation === 'juist' ? '✅' : (r.evaluation === 'onvolledig' ? '🤔' : '❌')) : (r.correct ? '✅' : '❌')
              return (
                <div key={r.id} className="rounded-xl bg-white p-3 text-purple-800 shadow ring-1 ring-purple-200">
                  <button onClick={toggle} className="flex w-full items-center justify-between text-left">
                    <span className="flex items-center gap-2 font-semibold"><span className="select-none">{icon}</span> Vraag {idx + 1}</span>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={`transition-transform ${open ? 'rotate-180' : ''}`}><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                  {open && (
                    <div className="mt-2 space-y-2 text-sm">
                      <p className="font-semibold">{r.text}</p>
                      {r.answer && (
                        <p><span className="font-semibold">Jouw antwoord:</span> {r.answer}</p>
                      )}
                      <p><span className="font-semibold">Uitleg:</span> {r.feedback || (r.correct ? 'Goed beantwoord.' : 'Nog niet voldoende.')}</p>
                      {r.model_answer && (
                        <p><span className="font-semibold">Modelantwoord:</span> {r.model_answer}</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {wrongFocus.length > 0 && (
            <button onClick={() => onSwitchToOverhoren(wrongFocus)} className="w-full rounded-xl bg-white py-3 font-semibold text-purple-700 hover:bg-purple-100">Oefen nu met Overhoren op je fouten</button>
          )}
        </div>
      )}
    </div>
  )
}

function Workspace({ context, mode, setMode, prompts, setModeFromCTA, richEmoji }) {
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

      {mode === 'Leren' && <ChatPanel mode={mode} context={context} prompts={prompts} richEmoji={richEmoji} />}
      {mode === 'Overhoren' && <ChatPanel mode={mode} context={context} prompts={prompts} richEmoji={richEmoji} />}
      {mode === 'Oefentoets' && (
        <OefentoetsPanel context={context} prompts={prompts} onSwitchToOverhoren={(focus) => setModeFromCTA('Overhoren', focus)} richEmoji={richEmoji} />
      )}
    </div>
  )
}

function AppInner() {
  const [prompts, setPrompts] = useLocalStorage('studiebot.prompts', defaultPrompts)
  const [isTeacher, setIsTeacher] = useLocalStorage('studiebot.isTeacher', false)
  const [richEmoji, setRichEmoji] = useLocalStorage('studiebot.richEmoji', false)
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
      <HeaderConfig prompts={prompts} setPrompts={setPrompts} isTeacher={isTeacher} setIsTeacher={setIsTeacher} richEmoji={richEmoji} setRichEmoji={setRichEmoji} />
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
              <Workspace context={context} mode={mode} setMode={setMode} prompts={prompts} setModeFromCTA={setModeFromCTA} richEmoji={richEmoji} />
            </div>
          )}
        </FadeSlide>
      </div>
    </div>
  )
}

function App() { return <AppInner /> }
export default App