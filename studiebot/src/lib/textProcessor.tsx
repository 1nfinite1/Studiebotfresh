"use client"

import React from 'react'
import { useEmojiMode } from '../emoji/EmojiModeContext'
import { useGlossaryHighlighter } from '../glossary/useGlossaryHighlighter'
import { GlossaryTerm } from '../glossary/GlossaryTerm'

export interface ProcessedTextProps {
  children: string
  className?: string
}

/**
 * ProcessedText component that applies the text processing pipeline:
 * 1. Emoji filtering (based on emoji mode)
 * 2. Glossary highlighting (if glossary terms are available)
 */
export function ProcessedText({ children: text, className = '' }: ProcessedTextProps) {
  const { filterEmojis } = useEmojiMode()
  const { highlightTerms } = useGlossaryHighlighter()

  // Step 1: Filter emojis based on mode
  const emojiFiltered = filterEmojis(text)

  // Step 1b: Strip markdown bold markers **...** so we can style via glossary highlighter
  const stripped = emojiFiltered.replace(/\*\*(.*?)\*\*/g, '$1')
  
  // Step 2: Highlight glossary terms
  const segments = highlightTerms(stripped)

  return (
    <span className={className}>
      {segments.map((segment, index) => {
        if (segment.isHighlighted && segment.term && segment.definition) {
          return (
            <GlossaryTerm
              key={`${segment.term}-${index}`}
              term={segment.term}
              definition={segment.definition}
            >
              {segment.text}
            </GlossaryTerm>
          )
        }
        return <span key={index}>{segment.text}</span>
      })}
    </span>
  )
}

/**
 * Hook for processing text without rendering
 */
export function useTextProcessor() {
  const { filterEmojis } = useEmojiMode()
  const { highlightTerms } = useGlossaryHighlighter()

  const processText = (text: string) => {
    // Step 1: Filter emojis
    const emojiFiltered = filterEmojis(text)
    
    // Step 2: Get highlighted segments
    const segments = highlightTerms(emojiFiltered)
    
    return {
      filteredText: emojiFiltered,
      segments,
    }
  }

  return { processText }
}