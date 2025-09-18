export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { srvQuizGenerate } from '../../../../../infra/llm/server/openaiClient';

export async function POST(req) {
  console.log('[quiz-generate] Starting request');
  try {
    const body = await req.json().catch((e) => {
      console.error('[quiz-generate] JSON parse error:', e.message);
      return {};
    });
    
    console.log('[quiz-generate] Request body:', JSON.stringify(body));
    
    const res = await srvQuizGenerate({
      topicId: String(body.topicId || ''),
      objective: String(body.objective || ''),
      currentBloom: body.currentBloom || 'remember',
      currentDifficulty: body.currentDifficulty || 'easy',
      subject: body.subject,
      grade: body.grade,
      chapter: body.chapter
    });
    
    console.log('[quiz-generate] Server function result:', res ? 'success' : 'null');
    
    const headers = new Headers({
      'X-Studiebot-LLM': res?.header === 'enabled' ? 'enabled' : 'disabled'
    });
    
    const response = {
      question_id: res?.question_id,
      type: res?.type,
      stem: res?.stem,
      choices: Array.isArray(res?.choices) ? res.choices : [],
      answer_key: res?.answer_key || {},
      objective: res?.objective,
      bloom_level: res?.bloom_level,
      difficulty: res?.difficulty,
      source_ids: Array.isArray(res?.source_ids) ? res.source_ids : [],
      hint: res?.hint,
      defined_terms: Array.isArray(res?.defined_terms) ? res.defined_terms : [],
      policy: res?.policy || {},
      notice: res?.notice
    };
    
    console.log('[quiz-generate] Returning response');
    return NextResponse.json(response, { headers });
    
  } catch (error) {
    console.error('[quiz-generate] Caught error:', error);
    const headers = new Headers({
      'X-Studiebot-LLM': 'disabled'
    });
    const errorResponse = {
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
      policy: { guardrail_triggered: false, reason: 'server_error' },
      notice: 'server_error'
    };
    
    console.log('[quiz-generate] Returning error response');
    return NextResponse.json(errorResponse, { status: 500, headers });
  }
}