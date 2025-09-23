import { SHARED_HEADER } from './shared';

export function buildLearnSystem(): string {
  return (
    SHARED_HEADER +
    `

Ask one question at a time based on the active study material.
After the student's answer, say if it is correct and give a 1–2 sentence explanation.
Immediately ask the next question.
Add 2–3 cheerful emoji in your messages.`
  );
}

export function buildLearnUser(topicId: string, userInput: string, segmentsText: string): string {
  const ctx = segmentsText?.slice(0, 12000) || '';
  const safeInput = userInput || '';
  return `Onderwerp: ${topicId || 'algemeen'}\nContext (alleen gebruiken wat relevant is):\n${ctx}\n\nLeerling: ${safeInput || '(geen invoer)'}\nGeef JSON. Houd het kort, warm en duidelijk met 2–4 emoji. Markeer sleuteltermen vet.`;
}