import { describe, it, expect } from 'vitest'
import { getLLMClient } from '../infra/llm/index'

describe('LLMClient noop', () => {
  it('generateHints returns hints array and optional notice', async () => {
    const llm = getLLMClient()
    const res = await llm.generateHints({ topicId: 'X', text: 'hello' })
    expect(res).toHaveProperty('hints')
    expect(Array.isArray(res.hints)).toBe(true)
    expect(typeof res.hints[0]).toBe('string')
    expect(res.notice || 'LLM not configured').toBeTypeOf('string')
  })

  it('gradeQuiz returns score number and feedback array', async () => {
    const llm = getLLMClient()
    const res = await llm.gradeQuiz({ answers: { a: '1', b: '2' } })
    expect(typeof res.score).toBe('number')
    expect(Array.isArray(res.feedback)).toBe(true)
    expect(res.notice || 'LLM not configured').toBeTypeOf('string')
  })
})