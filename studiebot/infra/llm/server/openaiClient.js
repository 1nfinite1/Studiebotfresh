// studiebot/infra/llm/server/openaiClient.js
import 'server-only';
import OpenAI from 'openai';
import { findMaterialForLLM } from '../../db/materialsService';

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
 * Check relevance of input to educational content (relaxed)
 * @param {OpenAI} client - OpenAI client
 * @param {string} text - Text to check
 * @returns {Promise<string>} 'on_topic' | 'off_topic' | 'not_in_material'
 */
async function checkRelevance(client, text) {
  if (!client || !text) return 'on_topic';
  // Relax relevance gating - treat common uncertainty expressions as on-topic
  const uncertaintyPatterns = [
    /ik\s+weet\s+(bijna\s+)?niets/i,
    /ik\s+weet\s+(niet\s+veel|weinig)/i,
    /geen\s+idee/i,
    /weet\s+ik\s+(niet|niets)/i,
  ];
  if (uncertaintyPatterns.some(pattern => pattern.test(text))) {
    return 'on_topic';
  }
  // Currently permissive
  return 'on_topic';
}

/**
 * Run all guardrail checks
 * @param {OpenAI} client - OpenAI client
 * @param {string} text - Text to check
 * @returns {Promise<Object>} { passed: boolean, reason?: string }
 */
async function runGuardrailChecks(client, text) {
  if (!text) return { passed: true };
  if (detectPromptInjection(text)) {
    return { passed: false, reason: 'prompt_injection' };
  }
  if (!client) return { passed: true };
  try {
    const moderation = await client.moderations.create({
      model: MODELS.moderation,
      input: text,
    });
    if (moderation.results?.[0]?.flagged) {
      return { passed: false, reason: 'unsafe' };
    }
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
 * Generate hints for Learn mode (Leren)
 */
export async function srvGenerateHints({ topicId, text, currentBloom = 'remember', currentDifficulty = 'easy', wasCorrect = null, subject, grade, chapter }) {
  try {
    const c = getClient();
    // Try to find relevant study material
    let material = null;
    try {
      material = await findMaterialForLLM(topicId, subject, grade, chapter);
    } catch (error) {
      console.error('Failed to fetch material for hints:', error.message);
    }
    const db_ok = !!material;

    if (!c) {
      return {
        hints: ['(stub) Benoem eerst 2-3 kernbegrippen.', '(stub) Leg het in je eigen woorden uit.'],
        tutor_message: '(stub) Probeer de hoofdpunten te benoemen.',
        follow_up_question: '(stub) Wat weet je al over dit onderwerp?',
        defined_terms: [],
        next_bloom: 'remember',
        next_difficulty: 'easy',
        notice: 'LLM not configured',
        header: 'disabled',
        policy: { guardrail_triggered: false, reason: 'none' },
        db_ok,
      };
    }

    // Guardrails
    const guardrailCheck = await runGuardrailChecks(c, text);

    const response = {
      hints: [],
      tutor_message: '',
      follow_up_question: '',
      defined_terms: [],
      next_bloom: currentBloom,
      next_difficulty: currentDifficulty,
      header: 'enabled',
      policy: { guardrail_triggered: false, reason: 'none' },
      db_ok,
    };

    if (!guardrailCheck.passed) {
      response.policy = sanitizeGuardrail(response, ['hints', 'tutor_message', 'follow_up_question'], guardrailCheck.reason);
      return response;
    }

    // Adaptive logic (simplified)
    let nextBloom = currentBloom;
    let nextDifficulty = currentDifficulty;
    if (wasCorrect === true) {
      if (currentDifficulty === 'easy') nextDifficulty = 'medium';
      else if (currentDifficulty === 'medium') nextDifficulty = 'hard';
      else if (currentBloom === 'remember') nextBloom = 'understand';
      else if (currentBloom === 'understand') nextBloom = 'apply';
    } else if (wasCorrect === false) {
      if (currentDifficulty === 'hard') nextDifficulty = 'medium';
      else if (currentDifficulty === 'medium') nextDifficulty = 'easy';
      else if (currentBloom === 'apply') nextBloom = 'understand';
      else if (currentBloom === 'understand') nextBloom = 'remember';
    }

    const system = `You are Studiebot, a friendly study coach. All student-visible text must be Dutch. JSON keys/enums remain English. Use the provided study material when available. Return JSON only with:\n- tutor_message (≤2 short Dutch sentences)\n- hints (1–3 short bullet hints)\n- follow_up_question (exactly 1 Dutch question)`;

    let user = `Onderwerp: ${topicId || 'algemeen'}\nLeerling antwoord: ${text || 'geen antwoord'}\nBloom niveau: ${nextBloom}\nMoeilijkheid: ${nextDifficulty}\nVorig antwoord was: ${wasCorrect === true ? 'correct' : wasCorrect === false ? 'incorrect' : 'onbekend'}`;

    if (material) {
      user += `\n\nStudiemateriaal:`;
      if (material.summary) user += `\nSamenvatting: ${material.summary}`;
      if (material.glossary && Array.isArray(material.glossary)) {
        user += `\nGlossary: ${material.glossary.map(term => `${term.term}: ${term.definition}`).join(', ')}`;
      }
      if (material.content) user += `\nInhoud: ${String(material.content).slice(0, 500)}`;
    }

    try {
      const resp = await c.chat.completions.create({
        model: MODELS.hints,
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      });
      const content = resp.choices?.[0]?.message?.content || '{}';
      const json = JSON.parse(content);
      response.hints = Array.isArray(json.hints) ? json.hints.slice(0, 3) : [];
      response.tutor_message = String(json.tutor_message || '').slice(0, 200);
      response.follow_up_question = String(json.follow_up_question || '').slice(0, 200);
      response.defined_terms = Array.isArray(json.defined_terms) ? json.defined_terms.slice(0, 5) : [];
      response.next_bloom = nextBloom;
      response.next_difficulty = nextDifficulty;
    } catch (error) {
      // Fallback
      response.hints = ['Probeer de hoofdpunten te benoemen.'];
      response.tutor_message = 'Laten we dit stap voor stap bekijken.';
      response.follow_up_question = 'Wat weet je al over dit onderwerp?';
    }

    return response;
  } catch (outerError) {
    console.error('[srvGenerateHints] Outer error caught:', outerError);
    return {
      hints: ['Er ging iets mis. Probeer het opnieuw.'],
      tutor_message: 'Er is een fout opgetreden.',
      follow_up_question: 'Kun je je vraag opnieuw stellen?',
      defined_terms: [],
      next_bloom: 'remember',
      next_difficulty: 'easy',
      notice: 'server_error',
      header: 'disabled',
      policy: { guardrail_triggered: false, reason: 'none' },
      db_ok: false,
    };
  }
}

/**
 * Generate quiz question for Quiz mode (Overhoren)
 */
export async function srvQuizGenerate({ topicId, objective, currentBloom = 'remember', currentDifficulty = 'easy', subject, grade, chapter }) {
  try {
    const c = getClient();
    // Try to find relevant study material
    let material = null;
    try {
      material = await findMaterialForLLM(topicId, subject, grade, chapter);
    } catch (error) {
      console.error('Failed to fetch material for quiz:', error.message);
    }
    const db_ok = !!material;

    if (!c) {
      return {
        question_id: 'stub-q1',
        type: 'mcq',
        stem: '(stub) Wat is de hoofdstad van Nederland?',
        choices: ['Amsterdam', 'Rotterdam', 'Den Haag', 'Utrecht'],
        answer_key: { correct: [0], explanation: '(stub) Amsterdam is de hoofdstad.' },
        objective: objective || 'stub-objective',
        bloom_level: currentBloom,
        difficulty: currentDifficulty,
        source_ids: [],
        hint: '(stub) Denk aan de grootste stad.',
        defined_terms: [],
        notice: 'LLM not configured',
        header: 'disabled',
        policy: { guardrail_triggered: false, reason: 'none' },
        db_ok,
      };
    }

    const response = {
      question_id: `q-${Date.now()}`,
      type: 'mcq',
      stem: '',
      choices: [],
      answer_key: { correct: [], explanation: '' },
      objective: objective || 'general',
      bloom_level: currentBloom,
      difficulty: currentDifficulty,
      source_ids: [],
      hint: null,
      defined_terms: [],
      header: 'enabled',
      policy: { guardrail_triggered: false, reason: 'none' },
      db_ok,
    };

    const system = `You are Studiebot. All student-visible text must be Dutch. JSON keys/enums remain English. Use the provided study material. Return JSON only for exactly one quiz item: question_id, type, stem, choices, answer_key, bloom_level, difficulty, hint|null, defined_terms[]. Keep the wording short and clear for ages 12–16.`;

    let user = `Onderwerp: ${topicId || 'algemeen'}\nLeerdoel: ${objective || 'algemene kennis'}\nBloom niveau: ${currentBloom}\nMoeilijkheid: ${currentDifficulty}\n\nMaak een vraag die past bij dit niveau en onderwerp.`;

    if (material) {
      user += `\n\nStudiemateriaal:`;
      if (material.summary) user += `\nSamenvatting: ${material.summary}`;
      if (material.glossary && Array.isArray(material.glossary)) {
        user += `\nGlossary: ${material.glossary.map(term => `${term.term}: ${term.definition}`).join(', ')}`;
      }
      if (material.content) user += `\nInhoud: ${String(material.content).slice(0, 500)}`;
    }

    try {
      const resp = await c.chat.completions.create({
        model: MODELS.quiz,
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      });

      const content = resp.choices?.[0]?.message?.content || '{}';
      const json = JSON.parse(content);
      response.question_id = json.question_id || response.question_id;
      response.type = json.type || 'mcq';
      response.stem = String(json.stem || '').slice(0, 500);
      response.choices = Array.isArray(json.choices) ? json.choices.slice(0, 6) : [];
      response.answer_key = json.answer_key || response.answer_key;
      response.hint = json.hint && typeof json.hint === 'string' ? json.hint.slice(0, 200) : null;
      response.defined_terms = Array.isArray(json.defined_terms) ? json.defined_terms.slice(0, 5) : [];
    } catch (error) {
      // Fallback
      response.stem = 'Wat kun je vertellen over dit onderwerp?';
      response.type = 'short_answer';
      response.choices = [];
      response.answer_key = { correct: [], explanation: 'Geef je beste antwoord.' };
    }

    return response;
  } catch (outerError) {
    console.error('[srvQuizGenerate] Outer error caught:', outerError);
    return {
      question_id: `error-${Date.now()}`,
      type: 'short_answer',
      stem: 'Er ging iets mis bij het genereren van de vraag.',
      choices: [],
      answer_key: { correct: [], explanation: 'Probeer het opnieuw.' },
      objective: objective || 'general',
      bloom_level: currentBloom,
      difficulty: currentDifficulty,
      source_ids: [],
      hint: null,
      defined_terms: [],
      notice: 'server_error',
      header: 'disabled',
      policy: { guardrail_triggered: false, reason: 'none' },
      db_ok: false,
    };
  }
}

/**
 * Grade quiz answers with detailed feedback and weak area analysis
 */
export async function srvGradeQuiz({ answers, questions = [], objectives = [], isExam = false, subject, grade, chapter, topicId }) {
  try {
    const c = getClient();
    // Try to find relevant study material
    let material = null;
    try {
      material = await findMaterialForLLM(topicId, subject, grade, chapter);
    } catch (error) {
      console.error('Failed to fetch material for grading:', error.message);
    }
    const db_ok = !!material;

    if (!c) {
      return {
        is_correct: false,
        score: 0.6,
        feedback: '(stub) Voorbeeldscore; LLM niet geconfigureerd.',
        tags: [],
        next_recommended_focus: ['Herhaal de hoofdpunten', 'Oefen met voorbeelden', 'Vraag uitleg'],
        weak_areas: [{ objective: 'algemeen', terms: ['kernbegrippen'] }],
        chat_prefill: 'Ik heb moeite met de hoofdpunten. Ik wil daarop oefenen.',
        notice: 'LLM not configured',
        header: 'disabled',
        policy: { guardrail_triggered: false, reason: 'none' },
        db_ok,
      };
    }

    // Guardrails
    const allText = Array.isArray(answers) ? answers.join(' ') : '';
    const guardrailCheck = await runGuardrailChecks(c, allText);

    const response = {
      is_correct: false,
      score: 0.0,
      feedback: '',
      tags: [],
      next_recommended_focus: [],
      weak_areas: [],
      chat_prefill: '',
      header: 'enabled',
      policy: { guardrail_triggered: false, reason: 'none' },
      db_ok,
    };

    if (!guardrailCheck.passed) {
      response.feedback = GUARDRAIL_MESSAGE;
      response.policy = sanitizeGuardrail(response, ['feedback'], guardrailCheck.reason);
      return response;
    }

    const system = `You are Studiebot. All student-visible text must be Dutch. JSON keys/enums remain English. Compare the student's answer to the material and return JSON only with:\n- is_correct\n- score (0..1)\n- feedback (1–2 short Dutch sentences: one compliment + one improvement)\n- weak_areas[]\n- next_recommended_focus[] (max 3)\n- chat_prefill (one Dutch sentence summarising what to practise)`;

    let user = `Beoordeel deze antwoorden:\nVragen: ${JSON.stringify(questions.slice(0, 10))}\nAntwoorden: ${JSON.stringify(answers?.slice(0, 10) || [])}\nLeerdoelen: ${JSON.stringify(objectives.slice(0, 5))}\n${isExam ? 'Dit is een toets - geef uitgebreide analyse.' : 'Dit is een quiz vraag.'}`;

    if (material) {
      user += `\n\nStudiemateriaal voor beoordeling:`;
      if (material.summary) user += `\nSamenvatting: ${material.summary}`;
      if (material.glossary && Array.isArray(material.glossary)) {
        user += `\nGlossary: ${material.glossary.map(term => `${term.term}: ${term.definition}`).join(', ')}`;
      }
      if (material.content) user += `\nInhoud: ${String(material.content).slice(0, 500)}`;
    }

    try {
      const resp = await c.chat.completions.create({
        model: MODELS.grade,
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      });

      const content = resp.choices?.[0]?.message?.content || '{}';
      const json = JSON.parse(content);
      response.is_correct = Boolean(json.is_correct);
      response.score = Math.max(0, Math.min(1, Number(json.score) || 0));
      response.feedback = String(json.feedback || 'Goed gedaan! Blijf oefenen.').slice(0, 300);
      response.tags = Array.isArray(json.tags) ? json.tags.slice(0, 5) : [];
      response.next_recommended_focus = Array.isArray(json.next_recommended_focus) ? json.next_recommended_focus.slice(0, 3) : [];
      response.weak_areas = Array.isArray(json.weak_areas) ? json.weak_areas.slice(0, 3) : [];
      const weakParts = json.chat_prefill_parts || [];
      if (weakParts.length === 0 && response.weak_areas.length > 0) {
        response.weak_areas.forEach(area => {
          if (area.terms && area.terms.length > 0) weakParts.push(...area.terms.slice(0, 2));
          else if (area.objective) weakParts.push(area.objective);
        });
      }
      if (weakParts.length === 1) response.chat_prefill = `Ik heb moeite met ${weakParts[0]}. Ik wil daarop oefenen.`;
      else if (weakParts.length === 2) response.chat_prefill = `Ik heb moeite met ${weakParts[0]} en ${weakParts[1]}. Ik wil daarop oefenen.`;
      else if (weakParts.length >= 3) response.chat_prefill = `Ik heb moeite met ${weakParts.slice(0, 3).join(', ')}. Ik wil daarop oefenen.`;
      else response.chat_prefill = 'Ik wil meer oefenen met deze stof.';
    } catch (error) {
      // Fallback
      response.score = 0.5;
      response.feedback = 'Goed geprobeerd! Probeer het nog eens met meer details.';
      response.next_recommended_focus = ['Herhaal de hoofdpunten', 'Oefen met voorbeelden'];
      response.chat_prefill = 'Ik wil meer oefenen met deze stof.';
    }

    return response;
  } catch (outerError) {
    console.error('[srvGradeQuiz] Outer error caught:', outerError);
    return {
      is_correct: false,
      score: 0.0,
      feedback: 'Er ging iets mis bij het beoordelen.',
      tags: [],
      next_recommended_focus: ['Probeer het opnieuw', 'Vraag om hulp'],
      weak_areas: [],
      chat_prefill: 'Ik wil meer hulp bij deze stof.',
      notice: 'server_error',
      header: 'disabled',
      policy: { guardrail_triggered: false, reason: 'none' },
      db_ok: false,
    };
  }
}

/**
 * Generate exam questions according to blueprint (optional)
 */
export async function srvExamGenerate({ topicId, blueprint = {}, totalQuestions = 5, subject, grade, chapter }) {
  const c = getClient();
  // Try to find relevant study material (for context and db_ok only)
  let material = null;
  try {
    material = await findMaterialForLLM(topicId, subject, grade, chapter);
  } catch (e) {
    console.error('Failed to fetch material for exam:', e.message);
  }
  const db_ok = !!material;

  if (!c) {
    return {
      questions: Array.from({ length: totalQuestions }, (_, i) => ({
        question_id: `stub-q${i + 1}`,
        type: 'mcq',
        stem: `(stub) Vraag ${i + 1} over ${topicId || 'algemeen'}`,
        choices: ['Optie A', 'Optie B', 'Optie C', 'Optie D'],
        answer_key: { correct: [0], explanation: '(stub) Uitleg' },
        objective: `objective-${i + 1}`,
        bloom_level: i < 2 ? 'remember' : i < 4 ? 'understand' : 'apply',
        difficulty: 'medium',
        source_ids: [],
        hint: null,
        defined_terms: [],
      })),
      blueprint: {
        by_objective: { OB1: 2, OB2: 2, OB3: 1 },
        by_level: { remember: 2, understand: 2, apply: 1 },
      },
      notice: 'LLM not configured',
      header: 'disabled',
      policy: { guardrail_triggered: false, reason: 'none' },
      db_ok,
    };
  }

  const response = {
    questions: [],
    blueprint: { by_objective: {}, by_level: { remember: 0, understand: 0, apply: 0 } },
    header: 'enabled',
    policy: { guardrail_triggered: false, reason: 'none' },
    db_ok,
  };

  const system = `You are Studiebot. All student-visible text must be Dutch. JSON keys/enums remain English. Generate N exam items (no hints or definitions). Keep wording short.`;
  const user = `Onderwerp: ${topicId || 'algemeen'}\nAantal vragen: ${totalQuestions}\nBlueprint: ${JSON.stringify(blueprint)}\n\nMaak een toets met diverse vraagtypen. Geen hints of definities.`;

  try {
    const resp = await c.chat.completions.create({
      model: MODELS.exam,
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });

    const content = resp.choices?.[0]?.message?.content || '{}';
    const json = JSON.parse(content);
    if (Array.isArray(json.questions)) {
      response.questions = json.questions.slice(0, totalQuestions).map(q => ({
        question_id: q.question_id || `q-${Date.now()}-${Math.random()}`,
        type: q.type || 'short_answer',
        stem: String(q.stem || '').slice(0, 500),
        choices: Array.isArray(q.choices) ? q.choices.slice(0, 6) : [],
        answer_key: q.answer_key || { correct: [], explanation: '' },
        objective: q.objective || 'general',
        bloom_level: q.bloom_level || 'remember',
        difficulty: q.difficulty || 'medium',
        source_ids: [],
        hint: null,
        defined_terms: [],
      }));
      response.questions.forEach(q => {
        response.blueprint.by_level[q.bloom_level] = (response.blueprint.by_level[q.bloom_level] || 0) + 1;
        response.blueprint.by_objective[q.objective] = (response.blueprint.by_objective[q.objective] || 0) + 1;
      });
    }
  } catch (error) {
    response.questions = Array.from({ length: Math.min(totalQuestions, 3) }, (_, i) => ({
      question_id: `fallback-q${i + 1}`,
      type: 'short_answer',
      stem: `Leg uit wat je weet over ${topicId || 'dit onderwerp'}.`,
      choices: [],
      answer_key: { correct: ['uitleg', 'begrip'], explanation: 'Geef een volledig antwoord.' },
      objective: 'general',
      bloom_level: 'understand',
      difficulty: 'medium',
      source_ids: [],
      hint: null,
      defined_terms: [],
    }));
  }

  return response;
}