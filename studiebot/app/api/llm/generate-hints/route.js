export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { srvGenerateHints } from '../../../../infra/llm/server/openaiClient';

function jsonOk(data, headers, status = 200) { return NextResponse.json({ ok: true, ...data }, { status, headers }); }
function jsonErr(status, reason, message, extra, headers) { return NextResponse.json({ ok: false, reason, message, ...extra }, { status, headers }); }

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const res = await srvGenerateHints({ topicId: String(body.topicId || body.topic || ''), text: String(body.text || ''), currentBloom: body.currentBloom || 'remember', currentDifficulty: body.currentDifficulty || 'easy', wasCorrect: body.wasCorrect, subject: body.subject, grade: body.grade, chapter: body.chapter });
    if (res?.no_material) {
      return jsonErr(400, 'no_material', res?.message || 'Er is nog geen lesmateriaal geactiveerd voor dit vak/leerjaar/hoofdstuk.', { policy: res?.policy, db_ok: res?.db_ok }, new Headers({ 'X-Debug': 'llm:learn|no_material' }));
    }
    const headers = new Headers({ 'X-Studiebot-LLM': res?.header === 'enabled' ? 'enabled' : 'disabled', 'X-Debug': 'llm:learn|used_material' });
    const payload = { tutor_message: res?.tutor_message || '', hints: Array.isArray(res?.hints) ? res.hints : [], follow_up_question: res?.follow_up_question || '', defined_terms: Array.isArray(res?.defined_terms) ? res.defined_terms : [], next_bloom: res?.next_bloom || 'remember', next_difficulty: res?.next_difficulty || 'easy', policy: res?.policy || { guardrail_triggered: false, reason: 'none' }, db_ok: Boolean(res?.db_ok) };
    return jsonOk(payload, headers);
  } catch (error) {
    return jsonErr(500, 'server_error', 'Onverwachte serverfout', { db_ok: false }, new Headers({ 'X-Debug': 'llm:learn|server_error' }));
  }
}