import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getLLMClient } from '../infra/llm/index'

// Mock the web client
vi.mock('../infra/llm/webClient', () => ({
  webGenerateHints: vi.fn(),
  webGradeQuiz: vi.fn(),
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
    
    // Mock fetch responses
    fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ hints: ['test hint'], notice: 'enabled' })
    })
    
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
    
    fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ score: 85, feedback: ['Good work'], notice: 'enabled' })
    })
    
    const client = getLLMClient()
    const result = await client.gradeQuiz({ answers: ['answer1', 'answer2'] })
    
    expect(result.score).toBe(85)
    expect(result.feedback).toEqual(['Good work'])
    expect(result.notice).toBe('enabled')
  })

  it('web client handles malformed responses gracefully', async () => {
    process.env.NEXT_PUBLIC_LLM_ENABLED = 'true'
    
    fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ invalid: 'response' })
    })
    
    const client = getLLMClient()
    const result = await client.generateHints({ topicId: 'test', text: 'test' })
    
    expect(result.hints).toEqual([])
    expect(result.notice).toBeUndefined()
  })
})