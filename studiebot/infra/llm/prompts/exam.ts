import { SYSTEM_HEADER } from './learn';

export function buildExamSystemGenerate(): string {
  return (
    SYSTEM_HEADER +
    `\nOEFENTOETS – GENERATE\nTaak: Genereer in één keer een korte oefentoets in het Nederlands.\nRegels:\n- 5 vragen (of 10 indien gevraagd).\n- Mix: ≥2 korte open vragen, ≥1 meerkeuze (A–D), ≥1 leg/verklaar.\n- Nummer de vragen.\n- GEEN antwoorden meeleveren.\n\nUitvoer in JSON: questions[] met question_id, type, stem, choices (indien meerkeuze), answer_key (optioneel lege placeholders).`);
}

export function buildExamUserGenerate(segmentsText: string, total: number): string {
  const ctx = segmentsText?.slice(0, 12000) || '';
  return `Context (alleen relevante delen gebruiken):\n${ctx}\n\nAantal vragen: ${total}.\nGenereer de toets (alleen vragen).`;
}

export function buildExamSystemGrade(): string {
  return (
    SYSTEM_HEADER +
    `\nOEFENTOETS – SUBMIT/NAKIJKEN\nTaak: Beoordeel de antwoorden heel kort en helder.\nRegels:\n- Geef per vraag: status correct|wrong|partial met emoji ✅❌🤔, een korte uitleg (max 2–3 zinnen) en een modelantwoord.\n- Wees warm en bemoedigend; 2–4 emoji in korte overall feedback mag, niet per item.\n\nUitvoer in JSON: is_correct, score (0..1), feedback (1–2 korte NL zinnen), weak_areas[], next_recommended_focus[], chat_prefill.`);
}

export function buildExamUserGrade(segmentsText: string, questions: string[], answers: string[]): string {
  const ctx = segmentsText?.slice(0, 12000) || '';
  return `Context (alleen relevante delen gebruiken):\n${ctx}\n\nVragen: ${JSON.stringify(questions.slice(0, 20))}\nAntwoorden: ${JSON.stringify(answers.slice(0, 20))}\nBeoordeel kort.`;
}