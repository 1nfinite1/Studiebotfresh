export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { srvGradeQuiz } from '../../../../infra/llm/server/openaiClient';

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const answers = Array.isArray(body.answers) ? body.answers : [];
    const res = await srvGradeQuiz({ answers });
    const headers = new Headers({
      'X-Studiebot-LLM': res?.header === 'enabled' ? 'enabled' : 'disabled'
    });
    return NextResponse.json(
      { score: Number(res?.score) || 0, feedback: Array.isArray(res?.feedback) ? res.feedback : [], policy: res?.policy || {}, notice: res?.notice },
      { headers }
    );
  } catch {
    return NextResponse.json({ score: 0, feedback: [], notice: 'server_error' }, { status: 500 });
  }
}