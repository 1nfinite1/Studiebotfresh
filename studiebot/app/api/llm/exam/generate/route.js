export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { srvExamGenerate } from '../../../../../infra/llm/server/openaiClient';
import { randomUUID } from 'crypto';
import { putExam } from '../store';

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const num = Number(body.num_items || body.totalQuestions) || 5;

    const res = await srvExamGenerate({
      topicId: String(body.topicId || body.topic || ''),
      blueprint: body.blueprint || {},
      totalQuestions: Math.min(Math.max(num, 1), 10),
      subject: body.subject,
      grade: body.grade,
      chapter: body.chapter,
    });

    const headers = new Headers({
      'X-Studiebot-LLM': res?.header === 'enabled' ? 'enabled' : 'disabled',
    });

    const exam_id = `ex_${randomUUID()}`;
    const items = (Array.isArray(res?.questions) ? res.questions : []).map((q, idx) => ({
      qid: q.question_id || `Q${idx + 1}`,
      type: q.type || 'short_answer',
      stem: String(q.stem || '').slice(0, 500),
      choices: Array.isArray(q.choices) ? q.choices : [],
      answer_key: q.answer_key || { correct: [], explanation: '' },
      bloom_level: q.bloom_level || 'remember',
      difficulty: q.difficulty || 'medium',
      source_ids: Array.isArray(q.source_ids) ? q.source_ids : [],
      hint: null,
      defined_terms: Array.isArray(q.defined_terms) ? q.defined_terms : [],
    }));

    // Store for submit grading
    putExam(exam_id, items);

    const payload = {
      ok: true,
      exam_id,
      items,
      policy: res?.policy || { guardrail_triggered: false, reason: 'none' },
      db_ok: Boolean(res?.db_ok),
    };

    return NextResponse.json(payload, { headers, status: 200 });
  } catch (e) {
    const errorResponse = {
      ok: false,
      error: 'server_error',
      exam_id: null,
      items: [],
      policy: { guardrail_triggered: false, reason: 'none' },
      db_ok: false,
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}