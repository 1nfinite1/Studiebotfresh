export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { srvGradeQuiz } from '@/infra/llm/server/openaiClient';

export async function POST(req) {
  const body = await req.json();
  const res = await srvGradeQuiz({ answers: Array.isArray(body.answers) ? body.answers : [] });
  const headers = new Headers({ 'X-Studiebot-LLM': res.header === 'enabled' ? 'enabled' : 'disabled' });
  return NextResponse.json({ score: res.score, feedback: res.feedback || [], policy: res.policy || {}, notice: res.notice }, { headers });
}