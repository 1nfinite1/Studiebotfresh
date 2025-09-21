import { SYSTEM_HEADER } from './learn';

export function buildExamSystemGenerate(): string {
  return (
    SYSTEM_HEADER +
    `\nOEFENTOETS – GENERATE\nTaak: Genereer in één keer een korte oefentoets in het Nederlands.\nRegels:\n- 5 vragen (of 10 indien gevraagd).\n- Mix: ≥2 korte open vragen, ≥1 meerkeuze (A–D), ≥1 leg/verklaar.\n- Nummer de vragen.\n- GEEN antwoorden meeleveren.\n\nUitvoer in JSON: questions[] met question_id, type, stem, choices (indien meerkeuze), answer_key (optioneel lege placeholders).`);
}

export function buildExamUserGenerate(segmentsText: string, total: number): string {
  const ctx = segmentsText?.slice(0, 12000) || '';
  return `Context (alleen relevante delen gebruiken):\n${ctx}\n\nAantal vragen: ${total}.\nGenereer de toets (alleen vragen, genummerd).`;
}

export function buildExamSystemGrade(): string {
  return (
    SYSTEM_HEADER +
    `\nOEFENTOETS – SUBMIT/NAKIJKEN\nTaak: Beoordeel het antwoord kort en helder, op basis van de context.\nRegels:\n- Geef JSON met: is_correct (bool), score (0..1), explanation (1–3 korte NL-zinnen), model_answer (compact NL antwoord).\n- Wees warm en bemoedigend; geen metatekst.\n- Gebruik alleen de context; geen speculatie buiten de stof.\n`);
}

export function buildExamUserGrade(segmentsText: string, question: string, student: string): string {
  const ctx = segmentsText?.slice(0, 12000) || '';
  return `Context (alleen relevante delen gebruiken):\n${ctx}\n\nVraag: ${question}\nAntwoord leerling: ${student}\nGeef JSON met velden: is_correct, score, explanation, model_answer.`;
}