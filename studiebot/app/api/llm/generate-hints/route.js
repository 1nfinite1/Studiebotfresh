export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { srvGenerateHints } from '@/infra/llm/server/openaiClient';

export async function POST(req) {
  const body = await req.json();
  const res = await srvGenerateHints({ topicId: String(body.topicId || ''), text: String(body.text || '') });
  const headers = new Headers({ 'X-Studiebot-LLM': res.header === 'enabled' ? 'enabled' : 'disabled' });
  return NextResponse.json({ hints: res.hints || [], policy: res.policy || {}, notice: res.notice }, { headers });
}