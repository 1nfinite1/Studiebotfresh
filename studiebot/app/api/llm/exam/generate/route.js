export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { srvExamGenerate } from '../../../../../infra/llm/server/openaiClient';
import { randomUUID } from 'crypto';
import { putExam } from '../store';

function jsonOk(data, headers, status = 200) { return NextResponse.json({ ok: true, ...data }, { status, headers }); }
function jsonErr(status, reason, message, extra, headers) { return NextResponse.json({ ok: false, reason, message, ...extra }, { status, headers }); }

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const num = Number(body.num_items || body.totalQuestions) || 5;
    const res = await srvExamGenerate({ topicId: String(body.topicId || body.topic || ''), blueprint: body.blueprint || {}, totalQuestions: Math.min(Math.max(num, 1), 10), subject: body.subject, grade: body.grade, chapter: body.chapter });
    if (res?.no_material) {
      return jsonErr(400, 'no_material', res?.message || 'Er is nog geen lesmateriaal geactiveerd.', { policy: res?.policy, db_ok: res?.db_ok }, new Headers({ 'X-Debug': 'llm:exam|no_material' }));
    }
    const headers = new Headers({
      'X-Studiebot-LLM': res?.header === 'enabled' ? 'enabled' : 'disabled',
      'X-Debug': 'llm:exam|used_material',
      'X-Context-Size': String(res?.context_len || 0),
      ...(res?.model ? { 'X-Model': String(res.model) } : {}),
      ...(res?.usage?.prompt_tokens != null ? { 'X-Prompt-Tokens': String(res.usage.prompt_tokens) } : {}),
      ...(res?.usage?.completion_tokens != null ? { 'X-Completion-Tokens': String(res.usage.completion_tokens) } : {}),
    });
    const exam_id = `ex_${randomUUID()}`;
    const items = (Array.isArray(res?.questions) ? res.questions : []).map((q, idx) => ({ qid: q.question_id || `Q${idx + 1}`, type: q.type || 'short_answer', stem: String(q.stem || '').slice(0, 500), choices: Array.isArray(q.choices) ? q.choices : [], answer_key: q.answer_key || { correct: [], explanation: '' }, bloom_level: q.bloom_level || 'remember', difficulty: q.difficulty || 'medium', source_ids: Array.isArray(q.source_ids) ? q.source_ids : [], hint: null, defined_terms: Array.isArray(q.defined_terms) ? q.defined_terms : [], }));
    putExam(exam_id, items);
    return jsonOk({ exam_id, items, policy: res?.policy || { guardrail_triggered: false, reason: 'none' }, db_ok: Boolean(res?.db_ok) }, headers);
  } catch (e) {
    return jsonErr(500, 'server_error', 'Onverwachte serverfout', { db_ok: false }, new Headers({ 'X-Debug': 'llm:exam|server_error' }));
  }
}