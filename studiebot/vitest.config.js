import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    globals: true,
    include: ['tests/**/*.test.{js,jsx}']
  },
  esbuild: {
    jsx: 'automatic',
    jsxDev: false,
    jsxImportSource: 'react'
  }
})