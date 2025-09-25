"// @ts-nocheck
"use client""

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

export type EmojiMode = 'NONE' | 'SOME' | 'MANY'

interface EmojiModeContextType {
  mode: EmojiMode
  setMode: (mode: EmojiMode) => void
  filterEmojis: (text: string) => string
}

const EmojiModeContext = createContext<EmojiModeContextType | undefined>(undefined)

interface EmojiModeProviderProps {
  children: React.ReactNode
}

const STORAGE_KEY = 'studiebot-emoji-mode'

export function EmojiModeProvider({ children }: EmojiModeProviderProps) {
  const [mode, setModeState] = useState<EmojiMode>('SOME')

  // Load saved mode from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved && ['NONE', 'SOME', 'MANY'].includes(saved)) {
        setModeState(saved as EmojiMode)
      }
    } catch (error) {
      console.warn('Failed to load emoji mode from localStorage:', error)
    }
  }, [])

  // Save mode to localStorage whenever it changes
  const setMode = useCallback((newMode: EmojiMode) => {
    setModeState(newMode)
    try {
      localStorage.setItem(STORAGE_KEY, newMode)
    } catch (error) {
      console.warn('Failed to save emoji mode to localStorage:', error)
    }
  }, [])

  // Filter emojis based on current mode
  const filterEmojis = useCallback((text: string): string => {
    if (!text || mode !== 'NONE') {
      return text
    }

    // Remove emojis when mode is NONE
    // This regex matches most Unicode emoji characters
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F700}-\u{1F77F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu

    return text.replace(emojiRegex, '').replace(/\s+/g, ' ').trim()
  }, [mode])

  const contextValue: EmojiModeContextType = {
    mode,
    setMode,
    filterEmojis,
  }

  return (
    <EmojiModeContext.Provider value={contextValue}>
      {children}
    </EmojiModeContext.Provider>
  )
}

export function useEmojiMode() {
  const context = useContext(EmojiModeContext)
  if (context === undefined) {
    throw new Error('useEmojiMode must be used within an EmojiModeProvider')
  }
  return context
}