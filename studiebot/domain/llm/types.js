// LLMClient interface (JSDoc)
/**
 * @typedef {Object} GradeQuizParams
 * @property {Record<string,string>} answers
 *
 * @typedef {Object} LLMClient
 * @property {(args: GradeQuizParams) => Promise<{ score: number; feedback: string[]; notice?: string }>} gradeQuiz
 */

export {}