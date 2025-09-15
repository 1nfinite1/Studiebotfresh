import noop from './noopClient'

// Factory: returns noop by default. Extend later if a real provider is added.
export function getLLMClient() {
  return noop
}