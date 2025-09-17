/**
 * Web client for calling LLM API endpoints from the UI
 */

/**
 * Generate hints via API endpoint
 * @param {Object} payload - Request payload
 * @param {string} payload.topicId - Topic identifier
 * @param {string} payload.text - Student input text
 * @returns {Promise<Object>} Response with hints array and notice
 */
export async function webGenerateHints(payload) {
  const r = await fetch('/api/llm/generate-hints', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
  return r.json();
}

/**
 * Grade quiz via API endpoint
 * @param {Object} payload - Request payload
 * @param {string[]} payload.answers - Array of student answers
 * @returns {Promise<Object>} Response with score and feedback
 */
export async function webGradeQuiz(payload) {
  const r = await fetch('/api/llm/grade-quiz', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
  return r.json();
}