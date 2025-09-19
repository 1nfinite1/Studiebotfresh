import 'server-only';

// Ephemeral in-memory store for generated exams (per server instance)
const map = new Map();

export function putExam(examId, items) {
  if (!examId || !Array.isArray(items)) return;
  map.set(examId, { items, createdAt: Date.now() });
}

export function getExam(examId) {
  if (!examId) return null;
  const entry = map.get(examId);
  return entry ? entry.items : null;
}

export function clearExam(examId) {
  if (!examId) return;
  map.delete(examId);
}