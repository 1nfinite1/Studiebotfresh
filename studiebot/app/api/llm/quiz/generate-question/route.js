export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { srvQuizGenerate } from '../../../../../infra/llm/server/openaiClient';

function jsonOk(data, headers, status = 200) { return NextResponse.json({ ok: true, ...data }, { status, headers }); }
function jsonErr(status, reason, message, extra, headers) { return NextResponse.json({ ok: false, reason, message, ...extra }, { status, headers }); }

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const res = await srvQuizGenerate({ topicId: String(body.topicId || body.topic || ''), objective: String(body.objective || ''), currentBloom: body.currentBloom || 'remember', currentDifficulty: body.currentDifficulty || 'easy', subject: body.subject, grade: body.grade, chapter: body.chapter });
    if (res?.no_material) {
      return jsonErr(400, 'no_material', res?.message || 'Er is nog geen lesmateriaal geactiveerd.', { policy: res?.policy, db_ok: res?.db_ok }, new Headers({ 'X-Debug': 'llm:quiz|no_material' }));
    }
    const headers = new Headers({
      'X-Studiebot-LLM': res?.header === 'enabled' ? 'enabled' : 'disabled',
      'X-Debug': 'llm:quiz|used_material',
      'X-Context-Size': String(res?.context_len || 0),
      ...(res?.model ? { 'X-Model': String(res.model) } : {}),
      ...(res?.usage?.prompt_tokens != null ? { 'X-Prompt-Tokens': String(res.usage.prompt_tokens) } : {}),
      ...(res?.usage?.completion_tokens != null ? { 'X-Completion-Tokens': String(res.usage.completion_tokens) } : {}),
    });
    const payload = { question_id: res?.question_id, type: res?.type, stem: res?.stem, choices: Array.isArray(res?.choices) ? res.choices : [], answer_key: res?.answer_key || {}, objective: res?.objective, bloom_level: res?.bloom_level, difficulty: res?.difficulty, source_ids: Array.isArray(res?.source_ids) ? res.source_ids : [], policy: res?.policy || { guardrail_triggered: false, reason: 'none' }, db_ok: Boolean(res?.db_ok) };
    return jsonOk(payload, headers);
  } catch (error) {
    return jsonErr(500, 'server_error', 'Onverwachte serverfout', { db_ok: false }, new Headers({ 'X-Debug': 'llm:quiz|server_error' }));
  }
}