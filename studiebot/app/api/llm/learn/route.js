export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { srvLearnTalk } from '../../../../infra/llm/server/openaiClient';

function ok(data = {}, headers, status = 200) { return NextResponse.json({ ok: true, ...data }, { status, headers }); }
function err(status, reason, message, extra = {}, headers) { return NextResponse.json({ ok: false, reason, message, ...extra }, { status, headers }); }

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const res = await srvLearnTalk({ topicId: String(body.topicId || body.topic || ''), text: String(body.text || ''), subject: body.subject, grade: body.grade, chapter: body.chapter });
    if (res?.no_material) {
      return err(400, 'no_material', res?.message || 'Er is nog geen lesmateriaal geactiveerd.', { db_ok: res?.db_ok }, new Headers({ 'X-Debug': 'llm:learn|no_material' }));
    }
    const headers = new Headers({
      'X-Debug': 'llm:learn|used_material',
      'X-Context-Size': String(res?.context_len || 0),
      ...(res?.model ? { 'X-Model': String(res.model) } : {}),
      ...(res?.usage?.prompt_tokens != null ? { 'X-Prompt-Tokens': String(res.usage.prompt_tokens) } : {}),
      ...(res?.usage?.completion_tokens != null ? { 'X-Completion-Tokens': String(res.usage.completion_tokens) } : {}),
    });
    return ok({ message: res?.message || '' }, headers);
  } catch {
    return err(500, 'server_error', 'Onverwachte serverfout', {}, new Headers({ 'X-Debug': 'llm:learn|server_error' }));
  }
}