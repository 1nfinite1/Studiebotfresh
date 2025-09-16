"use client"

import { useMemo } from 'react'
import { useGlossary } from './GlossaryProvider'

interface HighlightedSegment {
  text: string
  isHighlighted: boolean
  term?: string
  definition?: string
}

export function useGlossaryHighlighter() {
  const { glossary } = useGlossary()

  const highlightTerms = useMemo(() => {
    return (text: string): HighlightedSegment[] => {
      if (!text || glossary.terms.length === 0) {
        return [{ text, isHighlighted: false }]
      }

      // Sort terms by length (longest first) for greedy matching
      const sortedTerms = [...glossary.terms].sort((a, b) => b.term.length - a.term.length)
      
      const segments: HighlightedSegment[] = []
      let currentPosition = 0
      
      while (currentPosition < text.length) {
        let foundMatch = false
        
        // Try to find the longest matching term at current position
        for (const termData of sortedTerms) {
          const term = termData.term
          const termLength = term.length
          
          // Check if we have enough characters left
          if (currentPosition + termLength > text.length) continue
          
          // Extract the substring at current position
          const substring = text.substring(currentPosition, currentPosition + termLength)
          
          // Case-insensitive comparison
          if (substring.toLowerCase() === term.toLowerCase()) {
            // Check word boundaries - ensure the match is a complete word
            const beforeChar = currentPosition > 0 ? text[currentPosition - 1] : ' '
            const afterChar = currentPosition + termLength < text.length ? text[currentPosition + termLength] : ' '
            
            const isWordBoundaryBefore = /\s|^/.test(beforeChar) || /[.,!?;:"'()\[\]{}]/.test(beforeChar)
            const isWordBoundaryAfter = /\s|$/.test(afterChar) || /[.,!?;:"'()\[\]{}]/.test(afterChar)
            
            if (isWordBoundaryBefore && isWordBoundaryAfter) {
              // Add the highlighted term
              segments.push({
                text: substring,
                isHighlighted: true,
                term: termData.term,
                definition: termData.definition,
              })
              
              currentPosition += termLength
              foundMatch = true
              break
            }
          }
        }
        
        if (!foundMatch) {
          // No term found at current position, add single character to current segment
          const char = text[currentPosition]
          
          // Merge with previous non-highlighted segment if possible
          if (segments.length > 0 && !segments[segments.length - 1].isHighlighted) {
            segments[segments.length - 1].text += char
          } else {
            segments.push({
              text: char,
              isHighlighted: false,
            })
          }
          
          currentPosition++
        }
      }
      
      return segments
    }
  }, [glossary.terms])

  return {
    highlightTerms,
    hasTerms: glossary.terms.length > 0,
    isLoading: glossary.loading,
  }
}