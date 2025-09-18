export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { srvGradeQuiz } from '../../../../infra/llm/server/openaiClient';

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const answers = Array.isArray(body.answers) ? body.answers : [];
    const questions = Array.isArray(body.questions) ? body.questions : [];
    const objectives = Array.isArray(body.objectives) ? body.objectives : [];
    const isExam = Boolean(body.isExam);
    
    const res = await srvGradeQuiz({ answers, questions, objectives, isExam });
    const headers = new Headers({
      'X-Studiebot-LLM': res?.header === 'enabled' ? 'enabled' : 'disabled'
    });
    return NextResponse.json(
      {
        is_correct: Boolean(res?.is_correct),
        score: Number(res?.score) || 0,
        feedback: res?.feedback || '',
        tags: Array.isArray(res?.tags) ? res.tags : [],
        next_recommended_focus: Array.isArray(res?.next_recommended_focus) ? res.next_recommended_focus : [],
        weak_areas: Array.isArray(res?.weak_areas) ? res.weak_areas : [],
        chat_prefill: res?.chat_prefill || '',
        policy: res?.policy || {},
        notice: res?.notice
      },
      { headers }
    );
  } catch {
    return NextResponse.json({
      is_correct: false,
      score: 0,
      feedback: 'Er ging iets mis bij het beoordelen.',
      tags: [],
      next_recommended_focus: [],
      weak_areas: [],
      chat_prefill: '',
      notice: 'server_error'
    }, { status: 500 });
  }
}