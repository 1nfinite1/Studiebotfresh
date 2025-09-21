import { SYSTEM_HEADER } from './learn';

export function buildQuizSystem(): string {
  return (
    SYSTEM_HEADER +
    `\nOVERHOREN (Quiz) – één vraag per beurt, adaptief + variatie\nTaak: Overhoor de leerling op basis van de context.\nRegels per beurt:\n1) Stel precies ÉÉN vraag, verankerd in de context. Varieer: korte open vraag, meerkeuze (A–D), leg-uit-waarom, invulzin.\n2) Na het antwoord: geef 2–3 korte zinnen bemoedigende feedback (2–4 emoji), geef zo nodig het correcte/complete antwoord, en stel meteen ÉÉN nieuwe vraag.\n3) Pas moeilijkheid licht aan: iets moeilijker na goed; vereenvoudig na fout/onzeker.\n4) Geen zichtbare labels of metatekst.\n\nUitvoer in JSON met velden: question_id, type, stem (de vraagtekst), choices (optioneel), answer_key (optioneel).`);
}

export function buildQuizUser(topicId: string, segmentsText: string, objective?: string): string {
  const ctx = segmentsText?.slice(0, 12000) || '';
  return `Onderwerp: ${topicId || 'algemeen'}\nContext (alleen relevante delen gebruiken):\n${ctx}\n\nDoel: ${objective || 'algemeen'}\nStel precies één korte, concrete vraag. Geef JSON met question_id, type, stem, choices (A–D indien meerkeuze), answer_key (indices/tekst), zonder metatekst.`;
}