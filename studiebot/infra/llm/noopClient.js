/** @type {import('../../domain/llm/types.js').LLMClient} */
const client = {
  async generateHints({ topicId, text }) {
    return {
      hints: [
        'LLM not configured: dit is een voorbeeldhint gebaseerd op de ingevoerde tekst.',
        'Je kunt later een echte LLM-provider aansluiten. Tot die tijd werkt Studiebot in UI-only modus.'
      ],
      notice: 'LLM not configured'
    }
  },
  async gradeQuiz({ answers }) {
    const total = Object.keys(answers || {}).length || 1
    const score = Math.round(total * 0.6)
    return {
      score,
      feedback: [
        'LLM not configured: deze score is een stub. Voeg later een provider toe voor echte nakijkresultaten.',
        'Tip: controleer je antwoord op kernbegrippen en duidelijke voorbeelden.'
      ],
      notice: 'LLM not configured'
    }
  }
}

export default client