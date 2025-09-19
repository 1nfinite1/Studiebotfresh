export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { srvQuizGenerate } from '../../../../../infra/llm/server/openaiClient';

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));

    const res = await srvQuizGenerate({
      topicId: String(body.topicId || body.topic || ''),
      objective: String(body.objective || ''),
      currentBloom: body.currentBloom || 'remember',
      currentDifficulty: body.currentDifficulty || 'easy',
      subject: body.subject,
      grade: body.grade,
      chapter: body.chapter,
    });

    const headers = new Headers({
      'X-Studiebot-LLM': res?.header === 'enabled' ? 'enabled' : 'disabled',
    });

    const payload = {
      ok: true,
      question_id: res?.question_id,
      type: res?.type,
      stem: res?.stem,
      choices: Array.isArray(res?.choices) ? res.choices : [],
      answer_key: res?.answer_key || {},
      objective: res?.objective,
      bloom_level: res?.bloom_level,
      difficulty: res?.difficulty,
      source_ids: Array.isArray(res?.source_ids) ? res.source_ids : [],
      hint: res?.hint ?? null,
      defined_terms: Array.isArray(res?.defined_terms) ? res.defined_terms : [],
      policy: res?.policy || { guardrail_triggered: false, reason: 'none' },
      db_ok: Boolean(res?.db_ok),
    };

    return NextResponse.json(payload, { headers, status: 200 });
  } catch (error) {
    const headers = new Headers({ 'X-Studiebot-LLM': 'disabled' });
    const errorResponse = {
      ok: false,
      error: 'server_error',
      question_id: 'error',
      type: 'short_answer',
      stem: 'Er ging iets mis bij het genereren van de vraag.',
      choices: [],
      answer_key: {},
      objective: 'general',
      bloom_level: 'remember',
      difficulty: 'easy',
      source_ids: [],
      hint: null,
      defined_terms: [],
      policy: { guardrail_triggered: false, reason: 'none' },
      db_ok: false,
    };
    return NextResponse.json(errorResponse, { status: 500, headers });
  }
}