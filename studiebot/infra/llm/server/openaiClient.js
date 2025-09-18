// studiebot/infra/llm/server/openaiClient.js
import 'server-only';
import OpenAI from 'openai';

const ENABLED = process.env.LLM_ENABLED === 'true';
const PROVIDER = process.env.LLM_PROVIDER || 'openai';

const MODELS = {
  hints: process.env.OPENAI_MODEL_HINTS || 'gpt-4o-mini',
  grade: process.env.OPENAI_MODEL_GRADE || 'gpt-4o-mini',
  quiz: process.env.OPENAI_MODEL_QUIZ || 'gpt-4o-mini',
  exam: process.env.OPENAI_MODEL_EXAM || 'gpt-4o-mini',
  moderation: process.env.OPENAI_MODERATION_MODEL || 'omni-moderation-latest',
};

const GUARDRAIL_MESSAGE = "Dat hoort niet bij de les. Laten we verdergaan.";

function getClient() {
  if (!ENABLED || PROVIDER !== 'openai') return null;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

/**
 * Sanitize response when guardrails are triggered
 * @param {string[]} textFields - Fields to overwrite with guardrail message
 * @param {string} reason - Reason for guardrail trigger
 * @returns {Object} Policy object
 */
function sanitizeGuardrail(response, textFields, reason) {
  textFields.forEach(field => {
    if (response[field]) {
      if (Array.isArray(response[field])) {
        response[field] = [GUARDRAIL_MESSAGE];
      } else {
        response[field] = GUARDRAIL_MESSAGE;
      }
    }
  });
  return { guardrail_triggered: true, reason };
}

/**
 * Check for prompt injection patterns
 * @param {string} text - Text to check
 * @returns {boolean} True if injection detected
 */
function detectPromptInjection(text) {
  if (!text || typeof text !== 'string') return false;
  
  const injectionPatterns = [
    /ignore\s+all\s+previous/i,
    /forget\s+all\s+instructions/i,
    /vergeet\s+alle\s+instructies/i,
    /negeer\s+alle\s+vorige/i,
    /bypass\s+all/i,
    /omzeil\s+alle/i,
    /sudo\s+/i,
    /bomb|bom/i,
    /weapon|wapen/i,
    /hack|hacking/i,
    /system\s*:/i,
    /assistant\s*:/i,
  ];
  
  return injectionPatterns.some(pattern => pattern.test(text));
}

/**
 * Check relevance of input to educational content
 * @param {OpenAI} client - OpenAI client
 * @param {string} text - Text to check
 * @returns {Promise<string>} 'on_topic' | 'off_topic' | 'not_in_material'
 */
async function checkRelevance(client, text) {
  if (!client || !text) return 'on_topic';
  
  try {
    const response = await client.chat.completions.create({
      model: MODELS.grade,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Classify if student input is relevant to educational content. Return JSON: {"relevance": "on_topic"|"off_topic"|"not_in_material"}.
          
          on_topic: about lessons, subjects, homework, study questions
          off_topic: personal life, unrelated topics, entertainment
          not_in_material: asks about content not in curriculum`
        },
        {
          role: 'user',
          content: text.slice(0, 500) // Limit length
        }
      ]
    });
    
    const result = JSON.parse(response.choices[0].message.content || '{}');
    return result.relevance || 'on_topic';
  } catch {
    return 'on_topic'; // Default to allowing if check fails
  }
}

/**
 * Run all guardrail checks
 * @param {OpenAI} client - OpenAI client
 * @param {string} text - Text to check
 * @returns {Promise<Object>} { passed: boolean, reason?: string }
 */
async function runGuardrailChecks(client, text) {
  if (!text) return { passed: true };
  
  // Check prompt injection first (fastest)
  if (detectPromptInjection(text)) {
    return { passed: false, reason: 'prompt_injection' };
  }
  
  if (!client) return { passed: true };
  
  try {
    // Check moderation
    const moderation = await client.moderations.create({
      model: MODELS.moderation,
      input: text
    });
    
    if (moderation.results?.[0]?.flagged) {
      return { passed: false, reason: 'unsafe_moderation' };
    }
    
    // Check relevance
    const relevance = await checkRelevance(client, text);
    if (relevance !== 'on_topic') {
      return { passed: false, reason: 'relevance' };
    }
    
    return { passed: true };
  } catch {
    return { passed: true }; // Default to allowing if checks fail
  }
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