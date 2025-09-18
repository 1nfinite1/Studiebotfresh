export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { srvExamGenerate } from '../../../../../infra/llm/server/openaiClient';

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const res = await srvExamGenerate({
      topicId: String(body.topicId || ''),
      blueprint: body.blueprint || {},
      totalQuestions: Number(body.totalQuestions) || 5
    });
    const headers = new Headers({
      'X-Studiebot-LLM': res?.header === 'enabled' ? 'enabled' : 'disabled'
    });
    return NextResponse.json(
      {
        questions: Array.isArray(res?.questions) ? res.questions : [],
        blueprint: res?.blueprint || {},
        policy: res?.policy || {},
        notice: res?.notice
      },
      { headers }
    );
  } catch {
    return NextResponse.json({
      questions: [],
      blueprint: { by_objective: {}, by_level: {} },
      notice: 'server_error'
    }, { status: 500 });
  }
}