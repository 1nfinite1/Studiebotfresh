// @ts-nocheck
"use client"

import React from 'react'
import { Button } from './ui/button'
import { useEmojiMode, type EmojiMode } from '../src/emoji/EmojiModeContext'

interface EmojiModeToggleProps {
  className?: string
}

const modeLabels: Record<EmojiMode, { label: string; icon: string; description: string }> = {
  NONE: {
    label: 'None',
    icon: '🚫',
    description: 'No emojis shown'
  },
  SOME: {
    label: 'Some',
    icon: '😊',
    description: 'Moderate emoji usage'
  },
  MANY: {
    label: 'Many',
    icon: '🎉',
    description: 'Full emoji experience'
  }
}

const modeOrder: EmojiMode[] = ['NONE', 'SOME', 'MANY']

export function EmojiModeToggle({ className = '' }: EmojiModeToggleProps) {
  const { mode, setMode } = useEmojiMode()

  const handleToggle = () => {
    const currentIndex = modeOrder.indexOf(mode)
    const nextIndex = (currentIndex + 1) % modeOrder.length
    setMode(modeOrder[nextIndex])
  }

  const currentModeInfo = modeLabels[mode]

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-sm text-gray-600 dark:text-gray-400">
        Emojis:
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={handleToggle}
        className="
          flex items-center gap-2 px-3 py-1 h-8
          bg-white dark:bg-gray-800
          border-gray-200 dark:border-gray-700
          hover:bg-gray-50 dark:hover:bg-gray-700
          focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          transition-colors duration-200
        "
        aria-label={`Current emoji mode: ${currentModeInfo.label}. Click to change. ${currentModeInfo.description}`}
        title={currentModeInfo.description}
        type="button"
      >
        <span className="text-base" role="img" aria-hidden="true">
          {currentModeInfo.icon}
        </span>
        <span className="text-sm font-medium">
          {currentModeInfo.label}
        </span>
      </Button>
    </div>
  )
}