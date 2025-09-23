import { SHARED_HEADER } from './shared';

export function buildQuizSystem(): string {
  return (
    SHARED_HEADER +
    `

Ask one exam-style question at a time about the active material.
After the student's answer, give a judgment with one emoji: ✅, ❌, or 🤔.
Add 1–2 extra cheerful emoji, but keep the output concise.
Provide 1–2 sentences explaining why, then immediately ask the next question.`
  );
}

export function buildQuizUser(topicId: string, segmentsText: string, objective?: string): string {
  const ctx = segmentsText?.slice(0, 12000) || '';
  return `Onderwerp: ${topicId || 'algemeen'}\nContext (alleen relevante delen gebruiken):\n${ctx}\n\nDoel: ${objective || 'algemeen'}\nStel precies één korte, concrete vraag. Geef JSON met question_id, type, stem, choices (A–D indien meerkeuze), answer_key (correct indices/tekst), hint (max 1), zonder metatekst.`;
}