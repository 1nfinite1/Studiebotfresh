import '@testing-library/jest-dom'

// basic fetch mock fallback; individual tests can override
if (typeof global.fetch === 'undefined') {
  global.fetch = async (input, init) => {
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
}