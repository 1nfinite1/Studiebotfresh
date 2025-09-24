
import { SYSTEM_HEADER } from './learn';

export function buildExamSystemGenerate(): string {
  return (
    SYSTEM_HEADER +
    `\nOEFENTOETS – GENERATE
Doelgroep: HAVO onderbouw (12–14 jaar). Schrijf in eenvoudige woorden en korte zinnen.
Taak: Genereer in één keer een korte oefentoets in het Nederlands.

Regels voor de VRAGEN:
- Aantal: 5 (of 10 indien gevraagd).
- Mix: ≥2 korte open vragen, ≥1 meerkeuze (A–D), ≥1 leg/verklaar.
- Eén leerdoel per vraag; korte, duidelijke zinnen (≤ ~18 woorden).
- Types toegestaan: "mcq" (meerkeuze), "short_answer", "fill_in".
- Gebruik **exact** "mcq" voor meerkeuze.
- Bij type="mcq": lever **altijd** precies vier opties mee in "choices": ["A ...","B ...","C ...","D ..."].
- **Geen antwoord/solution meeleveren = géén "answer_key".** De **opties A–D horen er wél bij**.
- Nummer de vragen.

Uitvoer in JSON: questions[] met
- question_id, type ("mcq" | "short_answer" | "fill_in"),
- stem,
- choices (alleen bij "mcq"; precies 4),
- answer_key (weglaten of lege placeholder).`
  );
}

export function buildExamUserGenerate(segmentsText: string, total: number): string {
  const ctx = segmentsText?.slice(0, 12000) || '';
  return `Context (alleen relevante delen gebruiken):\n${ctx}\n\nAantal vragen: ${total}.\nGenereer de toets (alleen vragen, genummerd).`;
}

export function buildExamSystemGrade(): string {
  return (
    SYSTEM_HEADER +
    // ▶︎ Diagnose-regel: mild nakijken, synoniemen/eigen formuleringen tellen mee
    `\nDoelgroep: HAVO onderbouw (12–14 jaar). Beoordeel mild; synoniemen en korte eigen formuleringen kunnen ook correct zijn.\n` +
    `\nOEFENTOETS – SUBMIT/NAKIJKEN
Taak: Beoordeel het antwoord kort en helder, op basis van de context.
Regels:
- Geef JSON met: is_correct (bool), score (0..1), explanation (1–3 korte NL-zinnen), model_answer (compact NL antwoord).
- Wees warm en bemoedigend; geen metatekst.
- Gebruik alleen de context; geen speculatie buiten de stof.
`
  );
}

export function buildExamUserGrade(segmentsText: string, question: string, student: string): string {
  const ctx = segmentsText?.slice(0, 12000) || '';
  return `Context (alleen relevante delen gebruiken):\n${ctx}\n\nVraag: ${question}\nAntwoord leerling: ${student}\nGeef JSON met velden: is_correct, score, explanation, model_answer.`;
}
