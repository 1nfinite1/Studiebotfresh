export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { srvGenerateHints } from '../../../../infra/llm/server/openaiClient';

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const res = await srvGenerateHints({
      topicId: String(body.topicId || ''),
      text: String(body.text || ''),
      currentBloom: body.currentBloom || 'remember',
      currentDifficulty: body.currentDifficulty || 'easy',
      wasCorrect: body.wasCorrect
    });
    const headers = new Headers({
      'X-Studiebot-LLM': res?.header === 'enabled' ? 'enabled' : 'disabled'
    });
    return NextResponse.json(
      {
        hints: Array.isArray(res?.hints) ? res.hints : [],
        tutor_message: res?.tutor_message || '',
        follow_up_question: res?.follow_up_question || '',
        defined_terms: Array.isArray(res?.defined_terms) ? res.defined_terms : [],
        next_bloom: res?.next_bloom || 'remember',
        next_difficulty: res?.next_difficulty || 'easy',
        policy: res?.policy || {},
        notice: res?.notice
      },
      { headers }
    );
  } catch {
    return NextResponse.json({
      hints: [],
      tutor_message: '',
      follow_up_question: '',
      defined_terms: [],
      next_bloom: 'remember',
      next_difficulty: 'easy',
      policy: { guardrail_triggered: false, reason: 'server_error' },
      notice: 'server_error'
    }, { status: 500 });
  }
}