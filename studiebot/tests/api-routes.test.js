import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the server-only functions
vi.mock('../infra/llm/server/openaiClient', () => ({
  srvGenerateHints: vi.fn(),
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

import { srvGenerateHints, srvGradeQuiz, srvQuizGenerate, srvExamGenerate } from '../infra/llm/server/openaiClient'
import { NextResponse } from 'next/server'

describe('LLM API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /api/llm/generate-hints', () => {
    it('should handle successful hint generation', async () => {
      // Mock server function response
      srvGenerateHints.mockResolvedValue({
        hints: ['Test hint 1', 'Test hint 2'],
        header: 'enabled',
        policy: { guardrail_triggered: false },
        notice: 'success'
      })

      // Import and test the route handler
      const { POST } = await import('../app/api/llm/generate-hints/route.js')
      
      // Mock request
      const mockReq = {
        json: vi.fn().mockResolvedValue({
          topicId: 'test-topic',
          text: 'test text'
        })
      }

      const response = await POST(mockReq)

      expect(srvGenerateHints).toHaveBeenCalledWith({
        topicId: 'test-topic',
        text: 'test text'
      })

      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          hints: ['Test hint 1', 'Test hint 2'],
          policy: { guardrail_triggered: false },
          notice: 'success'
        },
        {
          headers: expect.any(Headers)
        }
      )
    })

    it('should handle errors gracefully', async () => {
      srvGenerateHints.mockRejectedValue(new Error('Test error'))

      const { POST } = await import('../app/api/llm/generate-hints/route.js')
      
      const mockReq = {
        json: vi.fn().mockResolvedValue({})
      }

      await POST(mockReq)

      expect(NextResponse.json).toHaveBeenCalledWith(
        { hints: [], notice: 'server_error' },
        { status: 500 }
      )
    })

    it('should handle malformed JSON', async () => {
      srvGenerateHints.mockResolvedValue({
        hints: ['Test hint'],
        header: 'disabled',
        policy: {},
        notice: 'disabled'
      })

      const { POST } = await import('../app/api/llm/generate-hints/route.js')
      
      const mockReq = {
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON'))
      }

      await POST(mockReq)

      expect(srvGenerateHints).toHaveBeenCalledWith({
        topicId: '',
        text: ''
      })
    })
  })

  describe('POST /api/llm/grade-quiz', () => {
    it('should handle successful quiz grading', async () => {
      srvGradeQuiz.mockResolvedValue({
        score: 85,
        feedback: ['Good work', 'Well done'],
        header: 'enabled',
        policy: { guardrail_triggered: false },
        notice: 'success'
      })

      const { POST } = await import('../app/api/llm/grade-quiz/route.js')
      
      const mockReq = {
        json: vi.fn().mockResolvedValue({
          answers: ['Answer 1', 'Answer 2']
        })
      }

      const response = await POST(mockReq)

      expect(srvGradeQuiz).toHaveBeenCalledWith({
        answers: ['Answer 1', 'Answer 2']
      })

      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          score: 85,
          feedback: ['Good work', 'Well done'],
          policy: { guardrail_triggered: false },
          notice: 'success'
        },
        {
          headers: expect.any(Headers)
        }
      )
    })

    it('should handle errors gracefully', async () => {
      srvGradeQuiz.mockRejectedValue(new Error('Test error'))

      const { POST } = await import('../app/api/llm/grade-quiz/route.js')
      
      const mockReq = {
        json: vi.fn().mockResolvedValue({})
      }

      await POST(mockReq)

      expect(NextResponse.json).toHaveBeenCalledWith(
        { score: 0, feedback: [], notice: 'server_error' },
        { status: 500 }
      )
    })

    it('should handle non-array answers', async () => {
      srvGradeQuiz.mockResolvedValue({
        score: 50,
        feedback: ['Try again'],
        header: 'disabled',
        policy: {},
        notice: 'disabled'
      })

      const { POST } = await import('../app/api/llm/grade-quiz/route.js')
      
      const mockReq = {
        json: vi.fn().mockResolvedValue({
          answers: 'not an array'
        })
      }

      await POST(mockReq)

      expect(srvGradeQuiz).toHaveBeenCalledWith({
        answers: []
      })
    })
  })
})