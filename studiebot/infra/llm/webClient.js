/** Web client for calling LLM API endpoints from the UI */

export async function webLearn(payload) {
  const r = await fetch('/api/llm/learn', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload || {}) });
  return r.json();
}

export async function webGenerateQuizQuestion(payload) {
  const r = await fetch('/api/llm/quiz/generate-question', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload || {}) });
  return r.json();
}

export async function webGradeQuiz(payload) {
  const r = await fetch('/api/llm/grade-quiz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload || {}) });
  return r.json();
}

export async function webGenerateExam(payload) {
  const r = await fetch('/api/llm/exam/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload || {}) });
  return r.json();
}

export async function webSubmitExam(payload) {
  const r = await fetch('/api/llm/exam/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload || {}) });
  return r.json();
}