export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { srvQuizGenerate } from '../../../../infra/llm/server/openaiClient';

function jsonOk(data, headers, status = 200) { return NextResponse.json({ ok: true, ...data }, { status, headers }); }
function jsonErr(status, reason, message, extra, headers) { return NextResponse.json({ ok: false, reason, message, ...extra }, { status, headers }); }

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));

    const res = await srvQuizGenerate({
      topicId: String(body.topicId || body.topic || ''),
      objective: body.objective || 'algemeen',
      currentBloom: body.currentBloom || 'remember',
      currentDifficulty: body.currentDifficulty || 'easy',
      subject: body.subject,
      grade: body.grade,
      chapter: body.chapter
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

    // Zorg dat het contract eenduidig is richting frontend:
    const payload = {
      question_id: res.question_id,
      type: res.type,                          // 'mcq' | 'short_answer' | 'fill_in' | 'explain' (afhankelijk van jouw implementatie)
      stem: res.stem,
      choices: Array.isArray(res.choices) ? res.choices.slice(0, 4) : undefined,
      answer_key: res.answer_key,
      difficulty: res.difficulty,
      hint: res.hint || null
    };

    const headers = new Headers({
      'X-Studiebot-LLM': res?.header === 'enabled' ? 'enabled' : 'disabled',
      'X-Debug': 'llm:quiz|question_generated',
      'X-Context-Size': String(res?.context_len || 0),
      ...(res?.model ? { 'X-Model': String(res.model) } : {}),
      ...(res?.usage?.prompt_tokens != null ? { 'X-Prompt-Tokens': String(res.usage.prompt_tokens) } : {}),
      ...(res?.usage?.completion_tokens != null ? { 'X-Completion-Tokens': String(res.usage.completion_tokens) } : {}),
    });

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
