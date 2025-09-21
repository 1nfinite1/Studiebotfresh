import { webGenerateHints, webGenerateQuizQuestion, webGradeQuiz, webGenerateExam, webSubmitExam } from './webClient';
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
    async generateHints({ topicId, text, currentBloom, currentDifficulty, wasCorrect, subject, grade, chapter }) {
      const res = await webGenerateHints({ topicId, text, currentBloom, currentDifficulty, wasCorrect, subject, grade, chapter });
      return {
        hints: Array.isArray(res.hints) ? res.hints : [],
        tutor_message: res.tutor_message,
        follow_up_question: res.follow_up_question,
        defined_terms: Array.isArray(res.defined_terms) ? res.defined_terms : [],
        next_bloom: res.next_bloom,
        next_difficulty: res.next_difficulty,
        notice: res.notice
      };
    },
    async generateQuizQuestion({ topicId, objective, currentBloom, currentDifficulty, subject, grade, chapter }) {
      const res = await webGenerateQuizQuestion({ topicId, objective, currentBloom, currentDifficulty, subject, grade, chapter });
      return {
        question_id: res.question_id,
        type: res.type,
        stem: res.stem,
        choices: Array.isArray(res.choices) ? res.choices : [],
        answer_key: res.answer_key || {},
        objective: res.objective,
        bloom_level: res.bloom_level,
        difficulty: res.difficulty,
        hint: res.hint,
        defined_terms: Array.isArray(res.defined_terms) ? res.defined_terms : [],
        notice: res.notice
      };
    },
    async gradeQuiz({ answers, questions, objectives, isExam, subject, grade, chapter }) {
      const res = await webGradeQuiz({ answers, questions, objectives, isExam, subject, grade, chapter });
      return {
        is_correct: res.is_correct,
        score: Number(res.score) || 0,
        feedback: res.feedback,
        tags: Array.isArray(res.tags) ? res.tags : [],
        next_recommended_focus: Array.isArray(res.next_recommended_focus) ? res.next_recommended_focus : [],
        weak_areas: Array.isArray(res.weak_areas) ? res.weak_areas : [],
        chat_prefill: res.chat_prefill,
        notice: res.notice
      };
    },
    async generateExam({ topicId, blueprint, totalQuestions, subject, grade, chapter }) {
      const res = await webGenerateExam({ topicId, blueprint, totalQuestions, subject, grade, chapter });
      return {
        questions: Array.isArray(res.items) ? res.items : (Array.isArray(res.questions) ? res.questions : []),
        blueprint: res.blueprint || {},
        exam_id: res.exam_id,
        notice: res.notice
      };
    },
    async submitExam({ answers, subject, grade, chapter }) {
      const res = await webSubmitExam({ answers, subject, grade, chapter });
      return res; // Return legacy JSON as-is
    }
  };
}