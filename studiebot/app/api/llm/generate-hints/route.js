export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { srvGenerateHints } from '../../../../infra/llm/server/openaiClient';

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));

    const res = await srvGenerateHints({
      topicId: String(body.topicId || body.topic || ''),
      text: String(body.text || ''),
      currentBloom: body.currentBloom || 'remember',
      currentDifficulty: body.currentDifficulty || 'easy',
      wasCorrect: body.wasCorrect,
      subject: body.subject,
      grade: body.grade,
      chapter: body.chapter,
    });

    const headers = new Headers({
      'X-Studiebot-LLM': res?.header === 'enabled' ? 'enabled' : 'disabled',
    });

    const payload = {
      ok: true,
      tutor_message: res?.tutor_message || '',
      hints: Array.isArray(res?.hints) ? res.hints : [],
      follow_up_question: res?.follow_up_question || '',
      defined_terms: Array.isArray(res?.defined_terms) ? res.defined_terms : [],
      next_bloom: res?.next_bloom || 'remember',
      next_difficulty: res?.next_difficulty || 'easy',
      policy: res?.policy || { guardrail_triggered: false, reason: 'none' },
      db_ok: Boolean(res?.db_ok),
    };

    return NextResponse.json(payload, { headers, status: 200 });
  } catch (error) {
    const headers = new Headers({ 'X-Studiebot-LLM': 'disabled' });
    const errorResponse = {
      ok: false,
      error: 'server_error',
      tutor_message: '',
      hints: [],
      follow_up_question: '',
      defined_terms: [],
      next_bloom: 'remember',
      next_difficulty: 'easy',
      policy: { guardrail_triggered: false, reason: 'none' },
      db_ok: false,
    };
    return NextResponse.json(errorResponse, { status: 500, headers });
  }
}