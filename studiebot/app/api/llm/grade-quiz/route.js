export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { srvGradeQuiz } from '../../../../infra/llm/server/openaiClient';

export async function POST(req) {
  console.log('[grade-quiz] Starting request');
  try {
    const body = await req.json().catch((e) => {
      console.error('[grade-quiz] JSON parse error:', e.message);
      return {};
    });
    
    console.log('[grade-quiz] Request body:', JSON.stringify(body));
    
    const answers = Array.isArray(body.answers) ? body.answers : [];
    const questions = Array.isArray(body.questions) ? body.questions : [];
    const objectives = Array.isArray(body.objectives) ? body.objectives : [];
    const isExam = Boolean(body.isExam);
    
    const res = await srvGradeQuiz({ 
      answers, 
      questions, 
      objectives, 
      isExam,
      subject: body.subject,
      grade: body.grade,
      chapter: body.chapter,
      topicId: body.topicId
    });
    
    console.log('[grade-quiz] Server function result:', res ? 'success' : 'null');
    
    const headers = new Headers({
      'X-Studiebot-LLM': res?.header === 'enabled' ? 'enabled' : 'disabled'
    });
    
    const response = {
      is_correct: Boolean(res?.is_correct),
      score: Number(res?.score) || 0,
      feedback: res?.feedback || '',
      tags: Array.isArray(res?.tags) ? res.tags : [],
      next_recommended_focus: Array.isArray(res?.next_recommended_focus) ? res.next_recommended_focus : [],
      weak_areas: Array.isArray(res?.weak_areas) ? res.weak_areas : [],
      chat_prefill: res?.chat_prefill || '',
      policy: res?.policy || {},
      notice: res?.notice
    };
    
    console.log('[grade-quiz] Returning response');
    return NextResponse.json(response, { headers });
    
  } catch (error) {
    console.error('[grade-quiz] Caught error:', error);
    const headers = new Headers({
      'X-Studiebot-LLM': 'disabled'
    });
    const errorResponse = {
      is_correct: false,
      score: 0,
      feedback: 'Er ging iets mis bij het beoordelen.',
      tags: [],
      next_recommended_focus: [],
      weak_areas: [],
      chat_prefill: '',
      policy: { guardrail_triggered: false, reason: 'server_error' },
      notice: 'server_error'
    };
    
    console.log('[grade-quiz] Returning error response');
    return NextResponse.json(errorResponse, { status: 500, headers });
  }
}