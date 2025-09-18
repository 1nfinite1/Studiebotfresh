export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { srvGenerateHints } from '../../../../infra/llm/server/openaiClient';

export async function POST(req) {
  console.log('[generate-hints] Starting request');
  try {
    const body = await req.json().catch((e) => {
      console.error('[generate-hints] JSON parse error:', e.message);
      return {};
    });
    
    console.log('[generate-hints] Request body:', JSON.stringify(body));
    
    const res = await srvGenerateHints({
      topicId: String(body.topicId || ''),
      text: String(body.text || ''),
      currentBloom: body.currentBloom || 'remember',
      currentDifficulty: body.currentDifficulty || 'easy',
      wasCorrect: body.wasCorrect,
      subject: body.subject,
      grade: body.grade,
      chapter: body.chapter
    });
    
    console.log('[generate-hints] Server function result:', res ? 'success' : 'null');
    
    const headers = new Headers({
      'X-Studiebot-LLM': res?.header === 'enabled' ? 'enabled' : 'disabled'
    });
    
    const response = {
      hints: Array.isArray(res?.hints) ? res.hints : [],
      tutor_message: res?.tutor_message || '',
      follow_up_question: res?.follow_up_question || '',
      defined_terms: Array.isArray(res?.defined_terms) ? res.defined_terms : [],
      next_bloom: res?.next_bloom || 'remember',
      next_difficulty: res?.next_difficulty || 'easy',
      policy: res?.policy || {},
      notice: res?.notice
    };
    
    console.log('[generate-hints] Returning response');
    return NextResponse.json(response, { headers });
    
  } catch (error) {
    console.error('[generate-hints] Caught error:', error);
    const errorResponse = {
      hints: [],
      tutor_message: '',
      follow_up_question: '',
      defined_terms: [],
      next_bloom: 'remember',
      next_difficulty: 'easy',
      policy: { guardrail_triggered: false, reason: 'server_error' },
      notice: 'server_error'
    };
    
    const headers = new Headers({
      'X-Studiebot-LLM': 'disabled'
    });
    
    console.log('[generate-hints] Returning error response');
    return NextResponse.json(errorResponse, { status: 500, headers });
  }
}