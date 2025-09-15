import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App from '../app/page.jsx'

beforeEach(() => {
  vi.stubGlobal('fetch', (url, opts) => {
    const u = typeof url === 'string' ? url : url.url
    if (u.includes('/runtime-config')) {
      return Promise.resolve(new Response(JSON.stringify({ backendUrl: '' }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    }
    if (u.includes('/api/materials/list')) {
      return Promise.resolve(new Response(JSON.stringify({ data: { items: [], set: null } }), { status: 200, headers: { 'Content-Type': 'application/json', 'X-Studiebot-DB': 'disabled' } }))
    }
    // default JSON
    return Promise.resolve(new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } }))
  })
})

describe('Studiebot UI (LLM disabled, DB disabled)', () => {
  it('renders, navigates, and shows LLM-disabled banner; chat produces stub', async () => {
    render(<App />)

    expect(await screen.findByText(/Welkom bij Studiebot/i)).toBeInTheDocument()

    // Choose a subject
    fireEvent.click(screen.getByText('Geschiedenis'))
    fireEvent.click(await screen.findByText('Leerjaar 2'))
    fireEvent.click(await screen.findByText('Hoofdstuk 1'))

    // Enter Leren mode
    fireEvent.click(await screen.findByText('Leren'))

    // Check banner
    expect(screen.getByTestId('llm-disabled')).toBeInTheDocument()

    const textarea = screen.getByPlaceholderText('Stel je vraag…')
    fireEvent.change(textarea, { target: { value: 'Hoi!' } })
    fireEvent.click(screen.getByText('Sturen'))

    await waitFor(() => {
      expect(screen.getByText(/LLM not configured/i)).toBeInTheDocument()
    })
  })

  it('materials admin empty state does not crash', async () => {
    render(<App />)
    fireEvent.click(screen.getByText('Config'))
    const checkbox = await screen.findByLabelText('Ik ben docent/beheerder')
    fireEvent.click(checkbox)
    expect(await screen.findByText(/Lesmateriaal beheren/)).toBeInTheDocument()
    expect(await screen.findByText(/Nog geen uploads\./)).toBeInTheDocument()
  })
})