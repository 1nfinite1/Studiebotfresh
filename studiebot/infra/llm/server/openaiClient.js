// studiebot/infra/llm/server/openaiClient.js
import 'server-only';
import OpenAI from 'openai';

const ENABLED = process.env.LLM_ENABLED === 'true';
const PROVIDER = process.env.LLM_PROVIDER || 'openai';

const MODELS = {
  hints: process.env.OPENAI_MODEL_HINTS || 'gpt-4o-mini',
  grade: process.env.OPENAI_MODEL_GRADE || 'gpt-4o-mini',
  moderation: process.env.OPENAI_MODERATION_MODEL || 'omni-moderation-latest',
};

function getClient() {
  if (!ENABLED || PROVIDER !== 'openai') return null;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

/**
 * Generate hints for a study topic
 * @param {Object} params - Parameters
 * @param {string} params.topicId - Topic identifier 
 * @param {string} params.text - Student input text
 * @returns {Promise<Object>} Response with hints, notice, header, and policy
 */
export async function srvGenerateHints({ topicId, text }) {
  const c = getClient();
  if (!c) {
    return {
      hints: [
        '(stub) Benoem eerst 2-3 kernbegrippen.',
        '(stub) Leg het in je eigen woorden uit.'
      ],
      notice: 'LLM not configured',
      header: 'disabled',
      policy: { guardrail_triggered: false, reason: 'ok' },
    };
  }

  // Moderation (best-effort)
  try {
    const m = await c.moderations.create({ model: MODELS.moderation, input: text || '' });
    const flagged = Array.isArray(m.results) && m.results[0]?.flagged;
    if (flagged) {
      return {
        hints: [],
        notice: 'moderation_blocked',
        header: 'enabled',
        policy: { guardrail_triggered: true, reason: 'unsafe' },
      };
    }
  } catch (_) { /* ignore moderation errors */ }

  const system = 'Je bent een Nederlandse studie-assistent. Geef 1–3 korte, concrete hints. Antwoord uitsluitend als JSON.';
  const user = `Onderwerp: ${topicId || ''}\nInbreng leerling: ${text || ''}`;

  const resp = await c.chat.completions.create({
    model: MODELS.hints,
    temperature: 0.3,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });

  let hints = [];
  try {
    const content = resp.choices?.[0]?.message?.content || '{}';
    const json = JSON.parse(content);
    hints = Array.isArray(json.hints) ? json.hints.map(String).slice(0, 3) : [];
  } catch (_) { hints = []; }

  return { hints, header: 'enabled', policy: { guardrail_triggered: false, reason: 'ok' } };
}

/**
 * Grade quiz answers
 * @param {Object} params - Parameters
 * @param {string[]} params.answers - Array of student answers
 * @returns {Promise<Object>} Response with score, feedback, notice, header, and policy
 */
export async function srvGradeQuiz({ answers }) {
  const c = getClient();
  if (!c) {
    return {
      score: 60,
      feedback: ['(stub) Voorbeeldscore; LLM niet geconfigureerd.'],
      notice: 'LLM not configured',
      header: 'disabled',
      policy: { guardrail_triggered: false, reason: 'ok' },
    };
  }

  const system = 'Je beoordeelt kort. Retourneer JSON met {score: 0..100, feedback: string[]}.';
  const user = `Beoordeel deze antwoorden: ${JSON.stringify(answers ?? []).slice(0, 4000)}`;

  const resp = await c.chat.completions.create({
    model: MODELS.grade,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });

  let score = 0; let feedback = [];
  try {
    const content = resp.choices?.[0]?.message?.content || '{}';
    const json = JSON.parse(content);
    score = Math.max(0, Math.min(100, Number(json.score) || 0));
    feedback = Array.isArray(json.feedback) ? json.feedback.map(String).slice(0, 5) : [];
  } catch (_) { /* keep defaults */ }

  return { score, feedback, header: 'enabled', policy: { guardrail_triggered: false, reason: 'ok' } };
}