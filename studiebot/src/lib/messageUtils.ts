/**
 * Utility functions for message processing and analysis
 */

/**
 * Determines if a message appears to be a question based on content
 */
export function isQuestion(text: string): boolean {
  if (!text || typeof text !== 'string') return false
  
  const trimmed = text.trim()
  
  // Check for question mark
  if (trimmed.endsWith('?')) return true
  
  // Check for common question words (case-insensitive)
  const questionWords = [
    'wat', 'wie', 'waar', 'wanneer', 'waarom', 'hoe', 'welke', 'welk',
    'what', 'who', 'where', 'when', 'why', 'how', 'which', 'whose',
    'kan', 'kun', 'kunt', 'mag', 'moet', 'zal', 'zou',
    'can', 'could', 'will', 'would', 'should', 'may', 'might'
  ]
  
  const words = trimmed.toLowerCase().split(/\s+/)
  const firstWord = words[0]
  
  return questionWords.includes(firstWord)
}

/**
 * Checks if a hint is valid and non-empty
 */
export function hasValidHint(hint: string | null | undefined): boolean {
  return Boolean(hint && typeof hint === 'string' && hint.trim().length > 0)
}

/**
 * Determines if a message should show a hint bubble
 */
export function shouldShowHint(messageText: string, hint: string | null | undefined): boolean {
  return isQuestion(messageText) && hasValidHint(hint)
}