// LLMClient interface (JSDoc)
/**
 * @typedef {Object} GenerateHintsParams
 * @property {string} topicId
 * @property {string} text
 *
 * @typedef {Object} GradeQuizParams
 * @property {Record<string,string>} answers
 *
 * @typedef {Object} LLMClient
 * @property {(args: GenerateHintsParams) => Promise<{ hints: string[]; notice?: string }>} generateHints
 * @property {(args: GradeQuizParams) => Promise<{ score: number; feedback: string[]; notice?: string }>} gradeQuiz
 */

export {}