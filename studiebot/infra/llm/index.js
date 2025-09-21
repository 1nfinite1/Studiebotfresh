import { webLearn, webGenerateQuizQuestion, webGradeQuiz, webGenerateExam, webSubmitExam } from './webClient';
import noopLLM from './noopClient';

export function getLLMClient() {
  const enabled = process.env.NEXT_PUBLIC_LLM_ENABLED === 'true';
  if (!enabled) return noopLLM;

  return {
    async learn({ topicId, text, subject, grade, chapter }) {
      const res = await webLearn({ topicId, text, subject, grade, chapter });
      return { message: res.message || '' };
    },
    async generateQuizQuestion({ topicId, objective, currentBloom, currentDifficulty, subject, grade, chapter }) {
      const res = await webGenerateQuizQuestion({ topicId, objective, currentBloom, currentDifficulty, subject, grade, chapter });
      return { question_id: res.question_id, type: res.type, stem: res.stem, choices: Array.isArray(res.choices) ? res.choices : [], answer_key: res.answer_key || {}, objective: res.objective, bloom_level: res.bloom_level, difficulty: res.difficulty, defined_terms: Array.isArray(res.defined_terms) ? res.defined_terms : [], notice: res.notice };
    },
    async gradeQuiz({ answers, questions, objectives, isExam, subject, grade, chapter }) {
      const res = await webGradeQuiz({ answers, questions, objectives, isExam, subject, grade, chapter });
      return { is_correct: res.is_correct, score: Number(res.score) || 0, feedback: res.feedback, tags: Array.isArray(res.tags) ? res.tags : [], next_recommended_focus: Array.isArray(res.next_recommended_focus) ? res.next_recommended_focus : [], weak_areas: Array.isArray(res.weak_areas) ? res.weak_areas : [], chat_prefill: res.chat_prefill, notice: res.notice };
    },
    async generateExam({ topicId, blueprint, totalQuestions, subject, grade, chapter }) {
      const res = await webGenerateExam({ topicId, blueprint, totalQuestions, subject, grade, chapter });
      return { questions: Array.isArray(res.items) ? res.items : (Array.isArray(res.questions) ? res.questions : []), blueprint: res.blueprint || {}, exam_id: res.exam_id, notice: res.notice };
    },
    async submitExam({ answers, subject, grade, chapter }) { const res = await webSubmitExam({ answers, subject, grade, chapter }); return res; }
  };
}