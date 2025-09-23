// quiz.ts

import { /* optional: reuse if you want */ } from './learn';

const SYSTEM_BASE = `Je bent Studiebot, een warme en motiverende tutor voor Nederlandse middelbare scholieren (12–16 jaar).
Taal: Altijd Nederlands. Stijl: kort, helder, geen metatekst. Gebruik uitsluitend de ACTIEVE context (segmentsText).`;

export function buildQuizSystem(): string {
  return `
Je bent Studiebot, een warme maar toetsgerichte tutor voor Nederlandse middelbare scholieren (12–16 jaar).
Taal: altijd Nederlands. Toon bij de VRAAG: kort en examengericht; de feedbackfase elders gebruikt ✅/❌/🤔.

📝 Overhoren (Quiz Mode)
Doel: Stel per beurt precies ÉÉN examenvraag op basis van de ACTIEVE context (segmentsText).

Regels:
- Vraagtypen: "open" | "mc" (A–D) | "invul" | "uitleg".
- De vraag ("stem") moet zelfstandig leesbaar zijn zonder extra context.
- Lever het juiste antwoord mee als "answer_key" (tekst of 'A'/'B' etc.).
- (Optioneel) "hint": één korte, relevante aanwijzing die de LEERLING richting het antwoord helpt,
  zonder het antwoord te verraden. De hint moet expliciet voortbouwen op de vraag (stem) en – bij mc –
  de aangeboden opties, NIET op losse contextregels.
- Bij mc: precies vier plausibele opties (A–D).

Uitvoer (strikt JSON, geen extra tekst):
{
  "question_id": "uniek binnen sessie",
  "type": "open|mc|invul|uitleg",
  "stem": "korte, heldere vraagtekst",
  "choices": ["A ...","B ...","C ...","D ..."],        // alleen bij type=mc
  "answer_key": "juiste tekst of index ('A' etc.)",
  "difficulty": "1|2|3",
  "hint": "één korte hint op basis van deze stem (optioneel)"
}
`;
}

export function buildQuizUser(
  topicId: string,
  segmentsText: string,
  objective?: string
): string {
  const ctx = (segmentsText || '').slice(0, 12000);
  return (
    `Onderwerp: ${topicId || 'algemeen'}\n` +
    `Context (alleen relevante delen gebruiken):\n${ctx}\n\n` +
    `Toetspunt/Doel: ${objective || 'algemeen'}\n` +
    `Taak: Genereer precies ÉÉN examenvraag en lever strikt JSON volgens het formaat.`
  );
}


/** Systeemprompt: hint mag nooit het antwoord weggeven; bouw voort op de vraag zelf. */
export function buildHintSystem(): string {
  return `
Je bent Studiebot. Taal: Nederlands. Taak: Geef ÉÉN korte, gerichte hint voor een EXAMENVRAAG.
Regels:
- Gebruik ALLEEN de vraag ("stem") en – indien aanwezig – de meerkeuze-opties ("choices") als directe context.
- Geef GEEN oplossing en noem NOOIT de juiste optie/het exacte antwoord.
- Wijs subtiel de relevante richting/definitie/regel/verband aan (max. 1–2 zinnen).
- Klinkt bemoedigend en specifiek, niet vaag ("Denk aan ...", "Let op het verschil tussen ...").
- Geen metatekst, geen labels. Uitvoer = enkel de hintzin(nen).`;
}

/** Userprompt voor hints — voert de concrete vraag door als context. */
export function buildHintUser(payload: {
  type: 'open' | 'mc' | 'invul' | 'uitleg',
  stem: string,
  choices?: string[]
}) : string {
  const base =
    `Vraagtype: ${payload.type}\n` +
    `Vraag (stem): ${payload.stem}\n`;
  const mc = payload.type === 'mc' && payload.choices?.length
    ? `Opties:\n${payload.choices.map((c, i) => `${String.fromCharCode(65+i)}. ${c}`).join('\n')}\n`
    : '';
  return base + mc + `\nGeef één korte hint in het Nederlands, zonder het antwoord te verklappen.`;
}
