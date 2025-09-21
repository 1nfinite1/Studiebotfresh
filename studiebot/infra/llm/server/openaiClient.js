// studiebot/infra/llm/server/openaiClient.js
import 'server-only';
import OpenAI from 'openai';
import { findMaterialForLLM, getActiveFor } from '../../db/materialsService';

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

function sanitizeGuardrail(response, textFields, reason) {
  textFields.forEach(field => {
    if (response[field] !== undefined) {
      if (Array.isArray(response[field])) {
        response[field] = [GUARDRAIL_MESSAGE];
      } else {
        response[field] = GUARDRAIL_MESSAGE;
      }
    }
  });
  return { guardrail_triggered: true, reason };
}

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

async function checkRelevance(_client, _text) {
  return 'on_topic';
}

async function runGuardrailChecks(client, text) {
  if (!text) return { passed: true };
  if (detectPromptInjection(text)) {
    return { passed: false, reason: 'prompt_injection' };
  }
  if (!client) return { passed: true };
  try {
    const moderation = await client.moderations.create({ model: MODELS.moderation, input: text });
    if (moderation.results?.[0]?.flagged) return { passed: false, reason: 'unsafe' };
    const relevance = await checkRelevance(client, text);
    if (relevance !== 'on_topic') return { passed: false, reason: 'relevance' };
    return { passed: true };
  } catch {
    return { passed: true };
  }
}

// Helper to fetch active material text context
async function getContext({ subject, grade, chapter, topicId }) {
  try {
    const { material, segmentsText, pagesCount } = await getActiveFor({ subject, grade, chapter });
    if (!material) {
      return { ok: false, reason: 'no_material', message: 'Er is nog geen lesmateriaal geactiveerd voor dit vak/leerjaar/hoofdstuk.', db_ok: true };
    }
    return { ok: true, material, text: segmentsText || '', pagesCount: pagesCount || 0 };
  } catch (e) {
    return { ok: false, reason: 'no_material', message: 'Er is nog geen lesmateriaal geactiveerd voor dit vak/leerjaar/hoofdstuk.', db_ok: false };
  }
}

export async function srvGenerateHints({ topicId, text, currentBloom = 'remember', currentDifficulty = 'easy', wasCorrect = null, subject, grade, chapter }) {
  const c = getClient();
  // Fetch context
  const ctx = await getContext({ subject, grade, chapter, topicId });
  if (!ctx.ok) {
    return { no_material: true, reason: ctx.reason, message: ctx.message, db_ok: ctx.db_ok, policy: { guardrail_triggered: false, reason: 'none' }, context_len: 0 };
  }
  try {
    if (!c) {
      return {
        hints: ['(stub) Benoem 2-3 kernbegrippen uit de tekst.'],
        tutor_message: '(stub) Laten we de hoofdpunten kort doornemen.',
        follow_up_question: '(stub) Wat vind je het lastigste stukje?',
        defined_terms: [], next_bloom: currentBloom, next_difficulty: currentDifficulty,
        header: 'disabled', policy: { guardrail_triggered: false, reason: 'none' }, db_ok: true, context_len: (ctx.text || '').length,
      };
    }
    const guardrailCheck = await runGuardrailChecks(c, text);
    const response = { hints: [], tutor_message: '', follow_up_question: '', defined_terms: [], next_bloom: currentBloom, next_difficulty: currentDifficulty, header: 'enabled', policy: { guardrail_triggered: false, reason: 'none' }, db_ok: true, context_len: (ctx.text || '').length };
    if (!guardrailCheck.passed) {
      response.policy = sanitizeGuardrail(response, ['hints', 'tutor_message', 'follow_up_question'], guardrailCheck.reason);
      return response;
    }

    const { buildLearnSystem, buildLearnUser } = await import('../prompts');
    const system = buildLearnSystem();
    const user = buildLearnUser(topicId || 'algemeen', text || '', ctx.text || '');

    try {
      const resp = await c.chat.completions.create({ model: MODELS.hints, temperature: 0.3, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] });
      const content = resp.choices?.[0]?.message?.content || '{}';
      const json = JSON.parse(content);
      response.hints = Array.isArray(json.hints) ? json.hints.slice(0, 3) : [];
      response.tutor_message = String(json.tutor_message || '').slice(0, 200);
      response.follow_up_question = String(json.follow_up_question || '').slice(0, 200);
    } catch {
      response.hints = ['Lees de kernpunten en leg die in je eigen woorden uit.'];
      response.tutor_message = 'Goed bezig! Laten we de kern samenvatten.';
      response.follow_up_question = 'Wat is volgens jou de hoofdboodschap?';
    }
    return response;
  } catch (outerError) {
    return { hints: ['Er ging iets mis.'], tutor_message: 'Fout opgetreden.', follow_up_question: 'Kun je je vraag opnieuw stellen?', defined_terms: [], next_bloom: 'remember', next_difficulty: 'easy', notice: 'server_error', header: 'disabled', policy: { guardrail_triggered: false, reason: 'none' }, db_ok: false, context_len: 0 };
  }
}

export async function srvQuizGenerate({ topicId, objective, currentBloom = 'remember', currentDifficulty = 'easy', subject, grade, chapter }) {
  const c = getClient();
  const ctx = await getContext({ subject, grade, chapter, topicId });
  if (!ctx.ok) {
    return { no_material: true, reason: ctx.reason, message: ctx.message, db_ok: ctx.db_ok, policy: { guardrail_triggered: false, reason: 'none' }, context_len: 0 };
  }
  try {
    if (!c) {
      return { question_id: 'stub-q1', type: 'mcq', stem: '(stub) Korte vraag bij de tekst.', choices: ['A', 'B', 'C', 'D'], answer_key: { correct: [0], explanation: '(stub) Uitleg' }, objective: objective || 'algemeen', bloom_level: currentBloom, difficulty: currentDifficulty, source_ids: [], hint: null, defined_terms: [], header: 'disabled', policy: { guardrail_triggered: false, reason: 'none' }, db_ok: true, context_len: (ctx.text || '').length };
    }
    const response = { question_id: `q-${Date.now()}`, type: 'mcq', stem: '', choices: [], answer_key: { correct: [], explanation: '' }, objective: objective || 'general', bloom_level: currentBloom, difficulty: currentDifficulty, source_ids: [], hint: null, defined_terms: [], header: 'enabled', policy: { guardrail_triggered: false, reason: 'none' }, db_ok: true, context_len: (ctx.text || '').length };
    const { buildQuizSystem, buildQuizUser } = await import('../prompts');
    const system = buildQuizSystem();
    const user = buildQuizUser(topicId || 'algemeen', ctx.text || '', objective || 'algemeen');
    try {
      const resp = await c.chat.completions.create({ model: MODELS.quiz, temperature: 0.4, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] });
      const content = resp.choices?.[0]?.message?.content || '{}';
      const json = JSON.parse(content);
      response.question_id = json.question_id || response.question_id;
      response.type = json.type || 'mcq';
      response.stem = String(json.stem || '').slice(0, 500);
      response.choices = Array.isArray(json.choices) ? json.choices.slice(0, 6) : [];
      response.answer_key = json.answer_key || response.answer_key;
      response.hint = json.hint && typeof json.hint === 'string' ? json.hint.slice(0, 200) : null;
      response.defined_terms = Array.isArray(json.defined_terms) ? json.defined_terms.slice(0, 5) : [];
    } catch {
      response.stem = 'Noem één belangrijk punt uit de tekst.';
      response.type = 'short_answer';
      response.choices = [];
      response.answer_key = { correct: [], explanation: 'Geef een beknopt antwoord.' };
    }
    return response;
  } catch {
    return { question_id: `error-${Date.now()}`, type: 'short_answer', stem: 'Er ging iets mis.', choices: [], answer_key: { correct: [], explanation: 'Probeer opnieuw.' }, objective: objective || 'general', bloom_level: currentBloom, difficulty: currentDifficulty, source_ids: [], hint: null, defined_terms: [], notice: 'server_error', header: 'disabled', policy: { guardrail_triggered: false, reason: 'none' }, db_ok: false, context_len: 0 };
  }
}

export async function srvGradeQuiz({ answers, questions = [], objectives = [], isExam = false, subject, grade, chapter, topicId }) {
  const c = getClient();
  const ctx = await getContext({ subject, grade, chapter, topicId });
  if (!ctx.ok) {
    return { no_material: true, reason: ctx.reason, message: ctx.message, db_ok: ctx.db_ok, policy: { guardrail_triggered: false, reason: 'none' }, context_len: 0 };
  }
  try {
    if (!c) {
      return { is_correct: false, score: 0.6, feedback: '(stub) Voorbeeldbeoordeling; LLM niet geconfigureerd.', tags: [], next_recommended_focus: ['Herhaal de hoofdpunten'], weak_areas: [{ objective: 'algemeen', terms: ['kernbegrippen'] }], chat_prefill: 'Ik wil oefenen met de kernbegrippen.', notice: 'LLM not configured', header: 'disabled', policy: { guardrail_triggered: false, reason: 'none' }, db_ok: true, context_len: (ctx.text || '').length };
    }
    const guardrailCheck = await runGuardrailChecks(c, Array.isArray(answers) ? answers.join(' ') : '');
    const response = { is_correct: false, score: 0.0, feedback: '', tags: [], next_recommended_focus: [], weak_areas: [], chat_prefill: '', header: 'enabled', policy: { guardrail_triggered: false, reason: 'none' }, db_ok: true, context_len: (ctx.text || '').length };
    if (!guardrailCheck.passed) {
      response.feedback = GUARDRAIL_MESSAGE;
      response.policy = sanitizeGuardrail(response, ['feedback'], guardrailCheck.reason);
      return response;
    }
    const system = `Je bent Studiebot. Alle student-tekst in NL. Geef JSON met: is_correct, score (0..1), feedback (1–2 korte NL zinnen), weak_areas[], next_recommended_focus[] (≤3), chat_prefill.`;
    const user = `Lesmateriaal samenvatting:\n${ctx.text.slice(0, 12000)}\n\nVragen: ${JSON.stringify(questions.slice(0, 10))}\nAntwoorden: ${JSON.stringify(answers?.slice(0, 10) || [])}`;
    try {
      const resp = await c.chat.completions.create({ model: MODELS.grade, temperature: 0.3, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] });
      const content = resp.choices?.[0]?.message?.content || '{}';
      const json = JSON.parse(content);
      response.is_correct = Boolean(json.is_correct);
      response.score = Math.max(0, Math.min(1, Number(json.score) || 0));
      response.feedback = String(json.feedback || 'Goed gedaan! Blijf oefenen.').slice(0, 300);
      response.tags = Array.isArray(json.tags) ? json.tags.slice(0, 5) : [];
      response.next_recommended_focus = Array.isArray(json.next_recommended_focus) ? json.next_recommended_focus.slice(0, 3) : [];
      response.weak_areas = Array.isArray(json.weak_areas) ? json.weak_areas.slice(0, 3) : [];
      const weakParts = json.chat_prefill_parts || [];
      if (!json.chat_prefill && weakParts.length > 0) {
        response.chat_prefill = `Ik heb moeite met ${weakParts.slice(0, 2).join(' en ')}. Ik wil daarop oefenen.`;
      } else {
        response.chat_prefill = json.chat_prefill || 'Ik wil meer oefenen met deze stof.';
      }
    } catch {
      response.score = 0.5;
      response.feedback = 'Goed geprobeerd! Probeer het nog eens met meer details.';
      response.next_recommended_focus = ['Herhaal de hoofdpunten', 'Oefen met voorbeelden'];
      response.chat_prefill = 'Ik wil meer oefenen met deze stof.';
    }
    return response;
  } catch {
    return { is_correct: false, score: 0.0, feedback: 'Er ging iets mis.', tags: [], next_recommended_focus: [], weak_areas: [], chat_prefill: '', notice: 'server_error', header: 'disabled', policy: { guardrail_triggered: false, reason: 'none' }, db_ok: false, context_len: 0 };
  }
}

export async function srvExamGenerate({ topicId, blueprint = {}, totalQuestions = 5, subject, grade, chapter }) {
  const c = getClient();
  const ctx = await getContext({ subject, grade, chapter, topicId });
  if (!ctx.ok) {
    return { no_material: true, reason: ctx.reason, message: ctx.message, db_ok: ctx.db_ok, policy: { guardrail_triggered: false, reason: 'none' }, context_len: 0 };
  }
  if (!c) {
    return {
      questions: Array.from({ length: totalQuestions }, (_, i) => ({ question_id: `stub-q${i + 1}`, type: 'mcq', stem: `(stub) Vraag ${i + 1}`, choices: ['A', 'B', 'C', 'D'], answer_key: { correct: [0], explanation: '(stub) Uitleg' }, objective: `objective-${i + 1}`, bloom_level: i < 2 ? 'remember' : i < 4 ? 'understand' : 'apply', difficulty: 'medium', source_ids: [], hint: null, defined_terms: [] })), blueprint: { by_objective: { OB1: 2, OB2: 2, OB3: 1 }, by_level: { remember: 2, understand: 2, apply: 1 } }, notice: 'LLM not configured', header: 'disabled', policy: { guardrail_triggered: false, reason: 'none' }, db_ok: true, context_len: (ctx.text || '').length,
    };
  }
  const response = { questions: [], blueprint: { by_objective: {}, by_level: { remember: 0, understand: 0, apply: 0 } }, header: 'enabled', policy: { guardrail_triggered: false, reason: 'none' }, db_ok: true, context_len: (ctx.text || '').length };
  const system = `Je bent Studiebot. Genereer N toetsvragen in het Nederlands (kort, duidelijk).`;
  const user = `Lesmateriaal:\n${ctx.text.slice(0, 12000)}\nAantal vragen: ${totalQuestions}.`;
  try {
    const resp = await c.chat.completions.create({ model: MODELS.exam, temperature: 0.4, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] });
    const content = resp.choices?.[0]?.message?.content || '{}';
    const json = JSON.parse(content);
    if (Array.isArray(json.questions)) {
      response.questions = json.questions.slice(0, totalQuestions).map(q => ({ question_id: q.question_id || `q-${Date.now()}-${Math.random()}`, type: q.type || 'short_answer', stem: String(q.stem || '').slice(0, 500), choices: Array.isArray(q.choices) ? q.choices.slice(0, 6) : [], answer_key: q.answer_key || { correct: [], explanation: '' }, objective: q.objective || 'general', bloom_level: q.bloom_level || 'remember', difficulty: q.difficulty || 'medium', source_ids: [], hint: null, defined_terms: [] }));
      response.questions.forEach(q => { response.blueprint.by_level[q.bloom_level] = (response.blueprint.by_level[q.bloom_level] || 0) + 1; response.blueprint.by_objective[q.objective] = (response.blueprint.by_objective[q.objective] || 0) + 1; });
    }
  } catch {
    response.questions = Array.from({ length: Math.min(totalQuestions, 3) }, (_, i) => ({ question_id: `fallback-q${i + 1}`, type: 'short_answer', stem: `Leg kort uit wat je weet over dit onderwerp.`, choices: [], answer_key: { correct: ['uitleg'], explanation: 'Geef een volledig antwoord.' }, objective: 'general', bloom_level: 'understand', difficulty: 'medium', source_ids: [], hint: null, defined_terms: [] }));
  }
  return response;
}