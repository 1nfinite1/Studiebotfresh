let memo
export async function getBackendUrl() {
  if (typeof memo === 'string') return memo
  try {
    const res = await fetch('/runtime-config', { cache: 'no-store' })
    const json = await res.json()
    memo = json?.backendUrl || process.env.NEXT_PUBLIC_BACKEND_URL || ''
  } catch {
    memo = process.env.NEXT_PUBLIC_BACKEND_URL || ''
  }
  return memo
}