"use client"

import React, { useState, useRef, useEffect } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover'

interface GlossaryTermProps {
  children: React.ReactNode
  term: string
  definition: string
  className?: string
}

export function GlossaryTerm({ children, term, definition, className = '' }: GlossaryTermProps) {
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isOpen && event.key === 'Escape') {
        setIsOpen(false)
        triggerRef.current?.focus()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  // Handle click outside to close
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
  }

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          ref={triggerRef}
          className={`
            inline font-bold underline decoration-2 underline-offset-2 
            cursor-pointer transition-colors duration-200
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded-sm
            hover:bg-purple-100 dark:hover:bg-purple-900/30
            text-purple-700 dark:text-purple-300
            decoration-purple-400 dark:decoration-purple-500
            ${className}
          `}
          aria-describedby={isOpen ? `tooltip-${term.replace(/\s+/g, '-')}` : undefined}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          type="button"
        >
          {children}
        </button>
      </PopoverTrigger>
      
      <PopoverContent 
        className="w-80 p-4 shadow-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
        id={`tooltip-${term.replace(/\s+/g, '-')}`}
        role="dialog"
        aria-labelledby={`term-title-${term.replace(/\s+/g, '-')}`}
        side="top"
        align="start"
        sideOffset={8}
      >
        <div className="space-y-2">
          <h4 
            id={`term-title-${term.replace(/\s+/g, '-')}`}
            className="font-semibold text-gray-900 dark:text-gray-100 text-sm"
          >
            {term}
          </h4>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            {definition}
          </p>
        </div>
        
        {/* Close instruction for screen readers */}
        <div className="sr-only">
          Press Escape to close this definition, or click outside.
        </div>
      </PopoverContent>
    </Popover>
  )
}