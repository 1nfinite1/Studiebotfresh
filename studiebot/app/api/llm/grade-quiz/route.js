export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { srvQuizGrade } from '../../../../infra/llm/server/openaiClient';

function jsonOk(data, headers, status = 200) { return NextResponse.json({ ok: true, ...data }, { status, headers }); }
function jsonErr(status, reason, message, extra, headers) { return NextResponse.json({ ok: false, reason, message, ...extra }, { status, headers }); }

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));

    // Verwacht payload:
    // {
    //   topicId, subject, grade, chapter,
    //   question: { question_id, type, stem, choices, answer_key, difficulty },
    //   user_answer: "..."
    // }

    const q = body?.question || {};
    const res = await srvQuizGrade({
      topicId: String(body.topicId || body.topic || ''),
      subject: body.subject,
      grade: body.grade,
      chapter: body.chapter,
      // vraag + leerlingantwoord doorgeven
      question: {
        question_id: q.question_id,
        type: q.type,
        stem: q.stem,
        choices: q.choices,
        answer_key: q.answer_key,
        difficulty: q.difficulty
      },
      user_answer: String(body.user_answer ?? '')
    });

    if (res?.no_material) {
      return jsonErr(
        400,
        'no_material',
        res?.message || 'Er is nog geen lesmateriaal geactiveerd.',
        { policy: res?.policy, db_ok: res?.db_ok },
        new Headers({ 'X-Debug': 'llm:quiz|no_material' })
      );
    }

    // Standaardiseer payload richting frontend
    const verdict = res?.verdict || (res?.is_correct === true ? 'correct' : (res?.is_correct === false ? 'incorrect' : 'partial'));
    const isCorrect = res?.is_correct ?? (verdict === 'correct');
    const emoji = isCorrect ? '✅' : (verdict === 'partial' ? '🤔' : '❌');
    const feedback = (res?.feedback || res?.explanation || '').toString().trim();
    const modelAnswer = (res?.model_answer || res?.answer_key || res?.solution || '').toString().trim();

    const headers = new Headers({
      'X-Studiebot-LLM': res?.header === 'enabled' ? 'enabled' : 'disabled',
      'X-Debug': `llm:quiz|graded`,
      'X-Context-Size': String(res?.context_len || 0),
      ...(res?.model ? { 'X-Model': String(res.model) } : {}),
      ...(res?.usage?.prompt_tokens != null ? { 'X-Prompt-Tokens': String(res.usage.prompt_tokens) } : {}),
      ...(res?.usage?.completion_tokens != null ? { 'X-Completion-Tokens': String(res.usage.completion_tokens) } : {}),
    });

    const payload = {
      verdict,                    // 'correct' | 'incorrect' | 'partial'
      is_correct: !!isCorrect,    // boolean
      emoji,                      // '✅' | '❌' | '🤔'
      feedback: feedback,         // 1–2 zinnen uitleg
      expected: modelAnswer,      // toonbaar “goed antwoord”
      normalized_user_answer: res?.normalized_user_answer || '',
      next_bloom: res?.next_bloom || 'remember',
      next_difficulty: res?.next_difficulty || 'easy',
      policy: res?.policy || { guardrail_triggered: false, reason: 'none' },
      db_ok: Boolean(res?.db_ok)
    };

    // Korte sanity guard (te lang = afkappen met ellipsis)
    if (payload.feedback && payload.feedback.length > 400) {
      payload.feedback = payload.feedback.slice(0, 400) + '…';
    }
    if (payload.expected && payload.expected.length > 400) {
      payload.expected = payload.expected.slice(0, 400) + '…';
    }

    return jsonOk(payload, headers);
  } catch (error) {
    return jsonErr(
      500,
      'server_error',
      'Onverwachte serverfout',
      { db_ok: false },
      new Headers({ 'X-Debug': 'llm:quiz|server_error' })
    );
  }
}
