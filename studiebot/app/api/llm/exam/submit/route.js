export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getExam, clearExam } from '../store';
import { srvGradeQuiz } from '../../../../../infra/llm/server/openaiClient';

function statusFromScore(score) {
  if (score >= 0.9) return 'correct';
  if (score >= 0.4) return 'partial';
  return 'incorrect';
}

function computeGrade(avgScore) {
  // Simple 0..10 scale
  const g = Math.round(avgScore * 100) / 10; // one decimal
  return Number(g.toFixed(1));
}

function normalizeStudentAnswer(item, answer) {
  if (answer == null) return '';
  if (typeof answer === 'string') return answer;
  // if MCQ indices provided, map to letters/texts; accept number or array
  if (item.type === 'mcq') {
    if (Array.isArray(answer)) {
      return answer.map((i) => item.choices?.[i] ?? String(i)).join(', ');
    }
    if (typeof answer === 'number') {
      return item.choices?.[answer] ?? String(answer);
    }
  }
  return String(answer);
}

function modelAnswerFromKey(item) {
  const key = item?.answer_key || {};
  if (item.type === 'mcq') {
    const idxs = Array.isArray(key.correct) ? key.correct : [];
    const texts = idxs.map((i) => item.choices?.[i]).filter(Boolean);
    return texts.length ? texts.join(', ') : (item.choices?.[idxs?.[0]] ?? '');
  }
  if (Array.isArray(key.correct) && key.correct.length && typeof key.correct[0] === 'string') {
    return key.correct[0];
  }
  return key.model || key.explanation || '';
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const examId = String(body.exam_id || '');
    const answers = Array.isArray(body.answers) ? body.answers : [];

    const items = getExam(examId);
    if (!items) {
      const payload = {
        ok: false,
        error: 'unknown_exam',
        score: 0,
        grade: 0,
        summary_line: 'Deze toets is niet gevonden. Maak een nieuwe toets.',
        focus_points: [],
        per_item: [],
        weak_areas: [],
        chat_prefill: 'Ik wil een nieuwe oefentoets maken.',
        policy: { guardrail_triggered: false, reason: 'none' },
        db_ok: true,
      };
      return NextResponse.json(payload, { status: 400 });
    }

    let totalScore = 0;
    const perItem = [];
    const allFocus = new Set();
    const weakAreasAgg = new Map(); // objective -> Set(terms)
    let dbOk = true;

    for (const item of items) {
      const ansObj = answers.find((a) => a.qid === item.qid) || {};
      const student = normalizeStudentAnswer(item, ansObj.answer);

      // Grade this single item using LLM (robust to DB missing)
      const res = await srvGradeQuiz({
        answers: [student],
        questions: [item.stem],
        objectives: [item.objective || 'general'],
        isExam: true,
      });

      dbOk = dbOk && (res?.db_ok !== false);

      const score = Math.max(0, Math.min(1, Number(res?.score) || 0));
      totalScore += score;
      const status = statusFromScore(score);

      // Aggregate focus points and weak areas
      (res?.next_recommended_focus || []).slice(0, 3).forEach((f) => allFocus.add(f));
      (res?.weak_areas || []).forEach((wa) => {
        const key = wa.objective || 'general';
        const set = weakAreasAgg.get(key) || new Set();
        (wa.terms || []).forEach((t) => set.add(t));
        weakAreasAgg.set(key, set);
      });

      const modelAnswer = modelAnswerFromKey(item);
      const explanation = (item?.answer_key?.explanation || res?.feedback || '').toString().slice(0, 300);

      perItem.push({
        qid: item.qid,
        status,
        student_answer: student,
        model_answer: modelAnswer,
        explanation: explanation || 'Korte uitleg volgt uit het modelantwoord.',
        objective: item.objective || 'general',
      });
    }

    const avgScore = items.length ? totalScore / items.length : 0;
    const scorePct = Math.round(avgScore * 100) / 100; // keep 2 decimals 0..1
    const focus_points = Array.from(allFocus).slice(0, 3);

    // Build weak_areas array
    const weak_areas = Array.from(weakAreasAgg.entries()).map(([objective, set]) => ({
      objective,
      terms: Array.from(set).slice(0, 5),
    }));

    let chat_prefill = 'Ik wil oefenen op mijn zwakke punten.';
    if (weak_areas.length) {
      const first = weak_areas[0];
      const t = first.terms?.[0] || first.objective;
      chat_prefill = `Ik heb moeite met ${t}. Kun je me overhoren?`;
    }

    const correctCount = perItem.filter((p) => p.status === 'correct').length;
    const summary_line = `Je hebt ${correctCount} van de ${items.length} vragen goed beantwoord.`;

    const payload = {
      ok: true,
      score: Number(scorePct.toFixed(2)),
      grade: computeGrade(avgScore),
      summary_line,
      focus_points,
      per_item: perItem,
      weak_areas,
      chat_prefill,
      policy: { guardrail_triggered: false, reason: 'none' },
      db_ok: dbOk,
    };

    // Optionally clear the stored exam to avoid memory growth
    clearExam(examId);

    return NextResponse.json(payload, { status: 200 });
  } catch (e) {
    const payload = {
      ok: false,
      error: 'server_error',
      score: 0,
      grade: 0,
      summary_line: 'Er ging iets mis bij het nakijken.',
      focus_points: [],
      per_item: [],
      weak_areas: [],
      chat_prefill: 'Ik wil een nieuwe oefentoets proberen.',
      policy: { guardrail_triggered: false, reason: 'none' },
      db_ok: false,
    };
    return NextResponse.json(payload, { status: 500 });
  }
}