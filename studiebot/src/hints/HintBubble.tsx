"use client"

import React, { useState, useRef, useEffect } from 'react'
import { Button } from '../../components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover'

interface HintBubbleProps {
  hint: string | null
  className?: string
}

export function HintBubble({ hint, className = '' }: HintBubbleProps) {
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // Don't render if no hint is available
  if (!hint || hint.trim() === '') {
    return null
  }

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

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
  }

  return (
    <div className={`flex justify-end mt-2 ${className}`}>
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            ref={triggerRef}
            variant="outline"
            size="sm"
            className="
              w-8 h-8 rounded-full p-0 
              bg-blue-50 hover:bg-blue-100 
              dark:bg-blue-900/20 dark:hover:bg-blue-900/40
              border-blue-200 dark:border-blue-700
              text-blue-700 dark:text-blue-300
              focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
              transition-colors duration-200
            "
            aria-label="Show hint"
            aria-expanded={isOpen}
            aria-haspopup="dialog"
            type="button"
          >
            ?
          </Button>
        </PopoverTrigger>
        
        <PopoverContent 
          className="w-80 p-4 shadow-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
          role="dialog"
          aria-labelledby="hint-title"
          side="top"
          align="end"
          sideOffset={8}
        >
          <div className="space-y-2">
            <h4 
              id="hint-title"
              className="font-semibold text-gray-900 dark:text-gray-100 text-sm flex items-center gap-2"
            >
              <span className="text-blue-600 dark:text-blue-400">💡</span>
              Hint
            </h4>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              {hint}
            </p>
          </div>
          
          {/* Close instruction for screen readers */}
          <div className="sr-only">
            Press Escape to close this hint, or click outside.
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}