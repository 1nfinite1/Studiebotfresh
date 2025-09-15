import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../app/page.jsx'

describe('SSR-safe smoke: home page', () => {
  it('renders without SSR-only crashes and shows the title', () => {
    // Rendering should not throw ReferenceError for window/document
    render(<App />)
    expect(screen.getByText(/Studiebot/i)).toBeInTheDocument()
  })
})