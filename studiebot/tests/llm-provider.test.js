import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getLLMClient } from '../infra/llm/index'
import { webGenerateHints, webGenerateQuizQuestion, webGradeQuiz, webGenerateExam } from '../infra/llm/webClient'

// Mock the web client
vi.mock('../infra/llm/webClient', () => ({
  webGenerateHints: vi.fn(),
  webGenerateQuizQuestion: vi.fn(),
  webGradeQuiz: vi.fn(),
  webGenerateExam: vi.fn(),
}))

// Mock fetch for web client calls
global.fetch = vi.fn()

describe('LLM Provider Factory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.NEXT_PUBLIC_LLM_ENABLED
  })

  it('returns noopLLM when NEXT_PUBLIC_LLM_ENABLED is not true', () => {
    process.env.NEXT_PUBLIC_LLM_ENABLED = 'false'
    const client = getLLMClient()
    
    expect(typeof client.generateHints).toBe('function')
    expect(typeof client.gradeQuiz).toBe('function')
    
    // Should be noop implementation that returns stub data
    expect(client.generateHints).toBeDefined()
    expect(client.gradeQuiz).toBeDefined()
  })

  it('returns noopLLM when NEXT_PUBLIC_LLM_ENABLED is undefined', () => {
    const client = getLLMClient()
    
    expect(typeof client.generateHints).toBe('function')
    expect(typeof client.gradeQuiz).toBe('function')
  })

  it('returns web-backed client when NEXT_PUBLIC_LLM_ENABLED is true', async () => {
    process.env.NEXT_PUBLIC_LLM_ENABLED = 'true'
    
    // Mock the web client function
    webGenerateHints.mockResolvedValueOnce({ hints: ['test hint'], notice: 'enabled' })
    
    const client = getLLMClient()
    
    expect(typeof client.generateHints).toBe('function')
    expect(typeof client.gradeQuiz).toBe('function')
    
    // Test generateHints call
    const result = await client.generateHints({ topicId: 'test', text: 'test' })
    expect(result.hints).toEqual(['test hint'])
    expect(result.notice).toBe('enabled')
  })

  it('web client handles gradeQuiz correctly', async () => {
    process.env.NEXT_PUBLIC_LLM_ENABLED = 'true'
    
    // Mock the web client function
    webGradeQuiz.mockResolvedValueOnce({ score: 85, feedback: ['Good work'], notice: 'enabled' })
    
    const client = getLLMClient()
    const result = await client.gradeQuiz({ answers: ['answer1', 'answer2'] })
    
    expect(result.score).toBe(85)
    expect(result.feedback).toEqual(['Good work'])
    expect(result.notice).toBe('enabled')
  })

  it('web client handles malformed responses gracefully', async () => {
    process.env.NEXT_PUBLIC_LLM_ENABLED = 'true'
    
    // Mock the web client function with invalid response
    webGenerateHints.mockResolvedValueOnce({ invalid: 'response' })
    
    const client = getLLMClient()
    const result = await client.generateHints({ topicId: 'test', text: 'test' })
    
    expect(result.hints).toEqual([])
    expect(result.notice).toBeUndefined()
  })

  it('web client generates quiz questions correctly', async () => {
    process.env.NEXT_PUBLIC_LLM_ENABLED = 'true'
    
    webGenerateQuizQuestion.mockResolvedValueOnce({
      question_id: 'q-123',
      type: 'mcq',
      stem: 'Test question?',
      choices: ['A', 'B', 'C', 'D'],
      answer_key: { correct: [0] },
      objective: 'test-obj',
      bloom_level: 'remember',
      difficulty: 'easy',
      hint: 'Test hint',
      defined_terms: [],
      notice: 'success'
    })
    
    const client = getLLMClient()
    const result = await client.generateQuizQuestion({ 
      topicId: 'test', 
      objective: 'test-obj',
      currentBloom: 'remember',
      currentDifficulty: 'easy'
    })
    
    expect(result.question_id).toBe('q-123')
    expect(result.type).toBe('mcq')
    expect(result.stem).toBe('Test question?')
    expect(result.choices).toEqual(['A', 'B', 'C', 'D'])
    expect(result.hint).toBe('Test hint')
  })

  it('web client generates exams correctly', async () => {
    process.env.NEXT_PUBLIC_LLM_ENABLED = 'true'
    
    webGenerateExam.mockResolvedValueOnce({
      questions: [
        { question_id: 'q1', stem: 'Question 1', type: 'mcq' },
        { question_id: 'q2', stem: 'Question 2', type: 'short_answer' }
      ],
      blueprint: {
        by_objective: { 'obj1': 1, 'obj2': 1 },
        by_level: { 'remember': 1, 'understand': 1 }
      },
      notice: 'success'
    })
    
    const client = getLLMClient()
    const result = await client.generateExam({ 
      topicId: 'test-topic',
      blueprint: {},
      totalQuestions: 2
    })
    
    expect(result.questions).toHaveLength(2)
    expect(result.questions[0].question_id).toBe('q1')
    expect(result.blueprint.by_objective).toEqual({ 'obj1': 1, 'obj2': 1 })
  })

  it('web client handles enhanced grading correctly', async () => {
    process.env.NEXT_PUBLIC_LLM_ENABLED = 'true'
    
    webGradeQuiz.mockResolvedValueOnce({
      is_correct: true,
      score: 0.85,
      feedback: 'Goed gedaan! Probeer meer details toe te voegen.',
      tags: ['geography', 'capitals'],
      next_recommended_focus: ['Oefen met kaarten', 'Leer hoofdsteden'],
      weak_areas: [{ objective: 'geography', terms: ['hoofdsteden'] }],
      chat_prefill: 'Ik heb moeite met hoofdsteden. Ik wil daarop oefenen.',
      notice: 'success'
    })
    
    const client = getLLMClient()
    const result = await client.gradeQuiz({ 
      answers: ['Amsterdam'],
      questions: ['Wat is de hoofdstad van Nederland?'],
      objectives: ['geography'],
      isExam: false
    })
    
    expect(result.is_correct).toBe(true)
    expect(result.score).toBe(0.85)
    expect(result.feedback).toBe('Goed gedaan! Probeer meer details toe te voegen.')
    expect(result.weak_areas).toHaveLength(1)
    expect(result.chat_prefill).toBe('Ik heb moeite met hoofdsteden. Ik wil daarop oefenen.')
  })
})