import { SHARED_HEADER } from './shared';

export function buildExamSystemGenerate(): string {
  return (
    SHARED_HEADER +
    `

Generate 5 or 10 exam questions in one numbered list.
Mix multiple-choice, short-open, and explain-why questions.
Do not provide answers yet.`
  );
}

export function buildExamUserGenerate(segmentsText: string, total: number): string {
  const ctx = segmentsText?.slice(0, 12000) || '';
  return `Context (alleen relevante delen gebruiken):\n${ctx}\n\nAantal vragen: ${total}.\nGenereer de toets (alleen vragen, genummerd).`;
}

export function buildExamSystemGrade(): string {
  return (
    SHARED_HEADER +
    `

Return JSON in this exact shape:

{
  "ok": true,
  "score": { "percentage": <number>, "correct": <number>, "partial": <number>, "wrong": <number>, "total": <number> },
  "feedback": [
    {
      "question": "...",
      "studentAnswer": "...",
      "status": "correct" | "wrong" | "partial",
      "emoji": "✅" | "❌" | "🤔",
      "explanation": "korte toelichting in het Nederlands",
      "modelAnswer": "ideaal antwoord"
    }
  ]
}

No extra fields allowed.`
  );
}

export function buildExamUserGrade(segmentsText: string, question: string, student: string): string {
  const ctx = segmentsText?.slice(0, 12000) || '';
  return `Context (alleen relevante delen gebruiken):\n${ctx}\n\nVraag: ${question}\nAntwoord leerling: ${student}\nGeef JSON met velden: is_correct, score, explanation, model_answer.`;
}