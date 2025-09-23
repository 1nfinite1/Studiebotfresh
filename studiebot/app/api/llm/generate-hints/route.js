export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { srvGenerateHints } from '../../../../infra/llm/server/openaiClient';

function jsonOk(data, headers, status = 200) { return NextResponse.json({ ok: true, ...data }, { status, headers }); }
function jsonErr(status, reason, message, extra, headers) { return NextResponse.json({ ok: false, reason, message, ...extra }, { status, headers }); }

/** Bouwt een veilige hint-prompt op basis van de vraag zelf (stem + opties). */
function buildHintPromptFromQuestion(question) {
  const type = (question?.type || 'open').trim();
  const stem = (question?.stem || '').trim();

  const choicesList = Array.isArray(question?.choices)
    ? question.choices.filter(Boolean).map((c, i) => `${String.fromCharCode(65 + i)}. ${String(c).trim()}`)
    : [];

  const choicesBlock = choicesList.length ? `Opties:\n${choicesList.join('\n')}\n` : '';

  return [
    '### INSTRUCTIE — VOLG STIPT (Nederlands)',
    'Geef precies ÉÉN korte, gerichte hint voor onderstaande EXAMENVRAAG.',
    'Regels:',
    '- Gebruik ALLEEN de vraag (stem) en – indien aanwezig – de meerkeuze-opties.',
    '- Verklap NOOIT het antwoord en noem NOOIT de juiste optie/woord/zin.',
    '- Wijs subtiel de juiste richting/definitie/regel/verband aan.',
    '- Maximaal 1–2 zinnen. Geen metatekst, geen labels, geen opsommingen.',
    '',
    '### VRAAG',
    `Type: ${type}`,
    `Stem: ${stem}`,
    choicesBlock,
    '### ANTWOORDFORMAT',
    'Schrijf enkel de hintzin(nen); geen extra tekst.'
  ].join('\n');
}


export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));

    // >>> PATCH: bouw hintprompt uit de (door de frontend meegestuurde) quizvraag
    const question = body?.question || null;
    const hintText = question?.stem
      ? buildHintPromptFromQuestion(question)
      : String(body.text || ''); // fallback op bestaand gedrag als er (nog) geen vraag wordt meegestuurd
    // <<< PATCH

    const res = await srvGenerateHints({
      topicId: String(body.topicId || body.topic || ''),
      text: hintText, // <<-- hier dwingen we de vraag-gebonden hint-context af
      currentBloom: body.currentBloom || 'remember',
      currentDifficulty: body.currentDifficulty || 'easy',
      wasCorrect: body.wasCorrect,
      subject: body.subject,
      grade: body.grade,
      chapter: body.chapter
    });

   // Bepaal welke input is gebruikt voor de hint (vraag of fallback)
const used = question?.stem ? 'used_question' : 'fallback_text';

if (res?.no_material) {
  return jsonErr(
    400,
    'no_material',
    res?.message || 'Er is nog geen lesmateriaal geactiveerd voor dit vak/leerjaar/hoofdstuk.',
    { policy: res?.policy, db_ok: res?.db_ok },
    new Headers({ 'X-Debug': 'llm:hints|no_material' })
  );
}

const headers = new Headers({
  'X-Studiebot-LLM': res?.header === 'enabled' ? 'enabled' : 'disabled',
  'X-Debug': `llm:hints|${used}`,
  'X-Context-Size': String(res?.context_len || 0),
  ...(res?.model ? { 'X-Model': String(res.model) } : {}),
  ...(res?.usage?.prompt_tokens != null ? { 'X-Prompt-Tokens': String(res.usage.prompt_tokens) } : {}),
  ...(res?.usage?.completion_tokens != null ? { 'X-Completion-Tokens': String(res.usage.completion_tokens) } : {}),
});
    
    const payload = {
      tutor_message: res?.tutor_message || '',
      hints: Array.isArray(res?.hints) ? res.hints : [],
      follow_up_question: res?.follow_up_question || '',
      defined_terms: Array.isArray(res?.defined_terms) ? res.defined_terms : [],
      next_bloom: res?.next_bloom || 'remember',
      next_difficulty: res?.next_difficulty || 'easy',
      policy: res?.policy || { guardrail_triggered: false, reason: 'none' },
      db_ok: Boolean(res?.db_ok)
    };

// Guardrail: normaliseer hints (max 200 chars, geen lege strings)
if (Array.isArray(payload.hints)) {
  payload.hints = payload.hints
    .map(h => String(h || '').trim())
    .filter(Boolean)
    .map(h => h.length > 200 ? h.slice(0, 200) + '…' : h);
}
    
    return jsonOk(payload, headers);
  } catch (error) {
    return jsonErr(
      500,
      'server_error',
      'Onverwachte serverfout',
      { db_ok: false },
      new Headers({ 'X-Debug': 'llm:learn|server_error' })
    );
  }
}
