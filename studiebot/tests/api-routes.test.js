import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the server-only functions
vi.mock('../infra/llm/server/openaiClient', () => ({
  srvGradeQuiz: vi.fn(),
  srvQuizGenerate: vi.fn(),
  srvExamGenerate: vi.fn(),
}))

// Mock NextResponse
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data, options) => ({
      json: () => Promise.resolve(data),
      headers: options?.headers || new Headers(),
      status: options?.status || 200,
    })),
  },
}))

import { srvGradeQuiz, srvQuizGenerate, srvExamGenerate } from '../infra/llm/server/openaiClient'
import { NextResponse } from 'next/server'

describe('LLM API Routes (no hints)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  describe('POST /api/llm/quiz/generate-question', () => {
    it('should handle successful quiz generation', async () => {
      srvQuizGenerate.mockResolvedValue({ question_id: 'q1', type: 'mcq', stem: 'Vraag?', choices: ['A','B','C','D'], answer_key: { correct:[0] }, header: 'enabled', policy: { guardrail_triggered: false } })
      const { POST } = await import('../app/api/llm/quiz/generate-question/route.js')
      const mockReq = { json: vi.fn().mockResolvedValue({ topicId: 't', objective: '', subject: 's', grade: 2, chapter: 1 }) }
      const response = await POST(mockReq)
      expect(srvQuizGenerate).toHaveBeenCalled()
      expect(NextResponse.json).toHaveBeenCalled()
    })
  })

  describe('POST /api/llm/grade-quiz', () => {
    it('web client handles gradeQuiz correctly', async () => {
      srvGradeQuiz.mockResolvedValue({ is_correct: true, score: 0.85, feedback: 'Goed zo!', tags: ['test'], next_recommended_focus: ['Blijf oefenen'], weak_areas: [], chat_prefill: 'Ik wil oefenen.', header: 'enabled', policy: { guardrail_triggered: false } })
      const { POST } = await import('../app/api/llm/grade-quiz/route.js')
      const mockReq = { json: vi.fn().mockResolvedValue({ answers: ['A1','A2'], questions: ['Q1','Q2'], objectives: ['O1','O2'], isExam: false }) }
      await POST(mockReq)
      expect(srvGradeQuiz).toHaveBeenCalled()
      expect(NextResponse.json).toHaveBeenCalled()
    })
  })

  describe('POST /api/llm/exam/generate', () => {
    it('should call exam generate', async () => {
      srvExamGenerate.mockResolvedValue({ questions: [{ question_id:'q1', stem: 'Vraag 1' }], header: 'enabled', policy: { guardrail_triggered: false } })
      const { POST } = await import('../app/api/llm/exam/generate/route.js')
      const mockReq = { json: vi.fn().mockResolvedValue({ topicId: 'test-topic', totalQuestions: 5 }) }
      await POST(mockReq)
      expect(srvExamGenerate).toHaveBeenCalled()
      expect(NextResponse.json).toHaveBeenCalled()
    })
  })
})