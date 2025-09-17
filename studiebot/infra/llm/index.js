import { webGenerateHints, webGradeQuiz } from './webClient';
import noopLLM from './noopClient';

/**
 * Factory function to get appropriate LLM client
 * Returns web-backed client if NEXT_PUBLIC_LLM_ENABLED is true, otherwise noop client
 * @returns {Object} LLM client implementation
 */
export function getLLMClient() {
  const enabled = process.env.NEXT_PUBLIC_LLM_ENABLED === 'true';
  if (!enabled) return noopLLM;

  return {
    async generateHints({ topicId, text }) {
      const res = await webGenerateHints({ topicId, text });
      return { hints: Array.isArray(res.hints) ? res.hints : [], notice: res.notice };
    },
    async gradeQuiz({ answers }) {
      const res = await webGradeQuiz({ answers });
      return { score: Number(res.score) || 0, feedback: Array.isArray(res.feedback) ? res.feedback : [], notice: res.notice };
    },
  };
}