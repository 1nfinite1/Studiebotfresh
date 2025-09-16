import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EmojiModeProvider, useEmojiMode } from '../src/emoji/EmojiModeContext'
import { EmojiModeToggle } from '../components/EmojiModeToggle'

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
global.localStorage = localStorageMock

// Test component for useEmojiMode hook
function TestEmojiComponent() {
  const { mode, setMode, filterEmojis } = useEmojiMode()
  
  return (
    <div>
      <div data-testid="mode">{mode}</div>
      <button onClick={() => setMode('NONE')}>Set None</button>
      <button onClick={() => setMode('SOME')}>Set Some</button>
      <button onClick={() => setMode('MANY')}>Set Many</button>
      <div data-testid="filtered">{filterEmojis('Hello 😊 World 🎉')}</div>
    </div>
  )
}

describe('Emoji Mode Features', () => {
  beforeEach(() => {
    localStorageMock.getItem.mockClear()
    localStorageMock.setItem.mockClear()
  })

  describe('EmojiModeProvider', () => {
    it('provides default mode SOME', () => {
      localStorageMock.getItem.mockReturnValue(null)
      
      render(
        <EmojiModeProvider>
          <TestEmojiComponent />
        </EmojiModeProvider>
      )

      expect(screen.getByTestId('mode')).toHaveTextContent('SOME')
    })

    it('loads saved mode from localStorage', () => {
      localStorageMock.getItem.mockReturnValue('NONE')
      
      render(
        <EmojiModeProvider>
          <TestEmojiComponent />
        </EmojiModeProvider>
      )

      expect(screen.getByTestId('mode')).toHaveTextContent('NONE')
    })

    it('filters emojis when mode is NONE', () => {
      localStorageMock.getItem.mockReturnValue('NONE')
      
      render(
        <EmojiModeProvider>
          <TestEmojiComponent />
        </EmojiModeProvider>
      )

      const filtered = screen.getByTestId('filtered')
      expect(filtered).toHaveTextContent('Hello World')
      expect(filtered).not.toHaveTextContent('😊')
      expect(filtered).not.toHaveTextContent('🎉')
    })

    it('preserves emojis when mode is SOME or MANY', () => {
      localStorageMock.getItem.mockReturnValue('SOME')
      
      render(
        <EmojiModeProvider>
          <TestEmojiComponent />
        </EmojiModeProvider>
      )

      const filtered = screen.getByTestId('filtered')
      expect(filtered).toHaveTextContent('Hello 😊 World 🎉')
    })
  })

  describe('EmojiModeToggle', () => {
    it('renders toggle with current mode', () => {
      localStorageMock.getItem.mockReturnValue('SOME')
      
      render(
        <EmojiModeProvider>
          <EmojiModeToggle />
        </EmojiModeProvider>
      )

      expect(screen.getByText('Emojis:')).toBeInTheDocument()
      expect(screen.getByText('Some')).toBeInTheDocument()
      expect(screen.getByText('😊')).toBeInTheDocument()
    })

    it('has proper button attributes', () => {
      render(
        <EmojiModeProvider>
          <EmojiModeToggle />
        </EmojiModeProvider>
      )

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('type', 'button')
      expect(button).toHaveAttribute('title')
      expect(button).toHaveAttribute('aria-label')
    })
  })
})