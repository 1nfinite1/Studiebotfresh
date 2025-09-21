/**
 * Web client for calling LLM API endpoints from the UI
 */

/**
 * Generate hints via API endpoint (Learn mode)
 * @param {Object} payload - Request payload
 * @param {string} payload.topicId - Topic identifier
 * @param {string} payload.text - Student input text
 * @param {string} payload.currentBloom - Current Bloom level
 * @param {string} payload.currentDifficulty - Current difficulty
 * @param {boolean} payload.wasCorrect - Whether previous answer was correct
 * @returns {Promise<Object>} Response with hints, tutor message, follow-up question
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
 * Generate quiz question via API endpoint (Quiz mode)
 * @param {Object} payload - Request payload
 * @param {string} payload.topicId - Topic identifier
 * @param {string} payload.objective - Learning objective
 * @param {string} payload.currentBloom - Current Bloom level
 * @param {string} payload.currentDifficulty - Current difficulty
 * @returns {Promise<Object>} Response with question data
 */
export async function webGenerateQuizQuestion(payload) {
  const r = await fetch('/api/llm/quiz/generate-question', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
  return r.json();
}

/**
 * Grade quiz answers via API endpoint
 * @param {Object} payload - Request payload
 * @param {string[]} payload.answers - Array of student answers
 * @param {string[]} payload.questions - Array of question texts
 * @param {string[]} payload.objectives - Array of learning objectives
 * @param {boolean} payload.isExam - Whether this is exam grading
 * @returns {Promise<Object>} Response with score, feedback, weak areas
 */
export async function webGradeQuiz(payload) {
  const r = await fetch('/api/llm/grade-quiz', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
  return r.json();
}

/**
 * Generate exam questions via API endpoint (Exam mode)
 * @param {Object} payload - Request payload
 * @param {string} payload.topicId - Topic identifier
 * @param {Object} payload.blueprint - Exam blueprint
 * @param {number} payload.totalQuestions - Total number of questions
 * @returns {Promise<Object>} Response with exam questions and blueprint
 */
export async function webGenerateExam(payload) {
  const r = await fetch('/api/llm/exam/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
  return r.json();
}

/**
 * Submit exam answers for grading
 * @param {Object} payload
 * @param {Array<{idx:number, question:string, answer:string}>} payload.answers
 * @param {string} payload.subject
 * @param {string|number} payload.grade
 * @param {string|number} payload.chapter
 * @returns {Promise<Object>} legacy-safe grading JSON
 */
export async function webSubmitExam(payload) {
  const r = await fetch('/api/llm/exam/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
  return r.json();
}