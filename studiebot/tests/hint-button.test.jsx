import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HintBubble } from '../src/hints/HintBubble'

describe('HintBubble', () => {
  it('does not render when hint is null', () => {
    render(<HintBubble hint={null} />)
    
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('does not render when hint is empty string', () => {
    render(<HintBubble hint="" />)
    
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('renders hint button when hint is provided', () => {
    render(<HintBubble hint="This is a helpful hint" />)
    
    const button = screen.getByRole('button')
    expect(button).toHaveTextContent('?')
    expect(button).toHaveAttribute('aria-label', 'Show hint')
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).toHaveAttribute('aria-haspopup', 'dialog')
  })

  it('has proper styling classes', () => {
    render(<HintBubble hint="Test hint" />)
    
    const button = screen.getByRole('button')
    expect(button).toHaveClass('w-8', 'h-8', 'rounded-full')
    expect(button).toHaveClass('bg-blue-50')
  })

  it('shows hint in container with proper positioning', () => {
    render(<HintBubble hint="Test hint" />)
    
    const container = screen.getByRole('button').closest('div')
    expect(container).toHaveClass('flex', 'justify-end', 'mt-2')
  })
})