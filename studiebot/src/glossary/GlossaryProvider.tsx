"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getBackendUrl } from '../lib/backendUrl.js'

interface GlossaryTerm {
  term: string
  definition: string
}

interface GlossaryState {
  terms: GlossaryTerm[]
  loading: boolean
  error: string | null
}

interface GlossaryContextType {
  glossary: GlossaryState
  fetchGlossary: (vak: string, leerjaar: string, hoofdstuk: string) => Promise<void>
  getTermDefinition: (term: string) => string | null
}

const GlossaryContext = createContext<GlossaryContextType | undefined>(undefined)

interface GlossaryProviderProps {
  children: React.ReactNode
}

export function GlossaryProvider({ children }: GlossaryProviderProps) {
  const [glossary, setGlossary] = useState<GlossaryState>({
    terms: [],
    loading: false,
    error: null,
  })

  // Cache for glossary data keyed by "vak-leerjaar-hoofdstuk"
  const [cache, setCache] = useState<Record<string, GlossaryTerm[]>>({})

  const fetchGlossary = useCallback(async (vak: string, leerjaar: string, hoofdstuk: string) => {
    const cacheKey = `${vak}-${leerjaar}-${hoofdstuk}`
    
    // Check cache first
    if (cache[cacheKey]) {
      setGlossary({
        terms: cache[cacheKey],
        loading: false,
        error: null,
      })
      return
    }

    setGlossary(prev => ({ ...prev, loading: true, error: null }))

    try {
      const backendUrl = await getBackendUrl()
      const params = new URLSearchParams({
        vak: vak || '',
        leerjaar: leerjaar || '',
        hoofdstuk: hoofdstuk || '',
      })
      
      const response = await fetch(`${backendUrl}/api/glossary?${params}`)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      const terms = data?.data?.terms || []

      // Update cache
      setCache(prev => ({ ...prev, [cacheKey]: terms }))
      
      setGlossary({
        terms,
        loading: false,
        error: null,
      })
    } catch (error) {
      console.error('Failed to fetch glossary:', error)
      setGlossary(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch glossary',
      }))
    }
  }, [cache])

  const getTermDefinition = useCallback((term: string): string | null => {
    if (!term || glossary.terms.length === 0) return null
    
    // Case-insensitive search for exact term match
    const normalizedTerm = term.toLowerCase().trim()
    const found = glossary.terms.find(
      t => t.term.toLowerCase().trim() === normalizedTerm
    )
    
    return found?.definition || null
  }, [glossary.terms])

  const contextValue: GlossaryContextType = {
    glossary,
    fetchGlossary,
    getTermDefinition,
  }

  return (
    <GlossaryContext.Provider value={contextValue}>
      {children}
    </GlossaryContext.Provider>
  )
}

export function useGlossary() {
  const context = useContext(GlossaryContext)
  if (context === undefined) {
    throw new Error('useGlossary must be used within a GlossaryProvider')
  }
  return context
}