export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { srvExamGradeItem } from '../../../../../infra/llm/server/openaiClient';

function ok(data = {}, status = 200, headers) { return NextResponse.json({ ok: true, ...data }, { status, headers }); }
function err(status, reason, message, extra = {}, headers) { return NextResponse.json({ ok: false, reason, message, ...extra }, { status, headers }); }

function statusFromScore(score) { if (score >= 0.9) return 'correct'; if (score >= 0.4) return 'partial'; return 'wrong'; }
function emojiFromStatus(s) { return s === 'correct' ? '✅' : s === 'partial' ? '🤔' : '❌'; }

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const answers = Array.isArray(body.answers) ? body.answers : [];
    const subject = body.subject; const grade = body.grade; const chapter = body.chapter;
    if (!answers.length) { return err(400, 'bad_request', 'answers[] ontbreekt of leeg', {}, new Headers({ 'X-Debug': 'llm:exam|grade|bad_request' })); }

    const items = [];
    let correct = 0, partial = 0, wrong = 0; let total = 0; let lastCtxSize = 0; let dbOk = true;
    let modelName = null; let promptTokens = 0; let completionTokens = 0;

    for (const a of answers) {
      const question = String(a.question || '');
      const student = String(a.answer || '');
      const res = await srvExamGradeItem({ question, answer: student, subject, grade, chapter });
      dbOk = dbOk && (res?.db_ok !== false);
      const sc = Math.max(0, Math.min(1, Number(res?.score) || 0));
      const status = statusFromScore(sc);
      if (status === 'correct') correct++; else if (status === 'partial') partial++; else wrong++;
      total++;
      lastCtxSize = res?.context_len || lastCtxSize;
      if (!modelName && res?.model) modelName = String(res.model);
      if (res?.usage) { promptTokens += Number(res.usage.prompt_tokens || 0); completionTokens += Number(res.usage.completion_tokens || 0); }
      items.push({
        question,
        studentAnswer: student,
        status,
        emoji: emojiFromStatus(status),
        explanation: String(res?.explanation || '').slice(0, 300) || 'Korte uitleg volgt uit het modelantwoord.',
        modelAnswer: String(res?.model_answer || '').slice(0, 300) || 'Kort, volledig antwoord volgens de stof.',
      });
    }

    const pct = total ? Math.round((correct + 0.5 * partial) / total * 100) : 0;
    const summary = `Je haalde ${pct}% op ${total} vragen. Goed bezig — kijk vooral naar de uitleg bij de items. 🎯`;

    const headers = new Headers({
      'X-Debug': 'llm:exam|grade|used_material',
      'X-Context-Size': String(lastCtxSize || 0),
      ...(modelName ? { 'X-Model': modelName } : {}),
      ...(promptTokens ? { 'X-Prompt-Tokens': String(promptTokens) } : {}),
      ...(completionTokens ? { 'X-Completion-Tokens': String(completionTokens) } : {}),
    });

    return ok({
      score: { percentage: pct, correct, partial, wrong, total },
      feedback: items,
      summary,
      chat_prefill: partial + wrong > 0 ? 'Ik heb nog moeite met enkele onderdelen uit de toets, kun je me verder overhoren?' : 'Ik wil verder oefenen met nieuwe vragen.',
    }, 200, headers);
  } catch (e) {
    return err(500, 'server_error', 'Onverwachte serverfout', { }, new Headers({ 'X-Debug': 'llm:exam|grade|server_error' }));
  }
}