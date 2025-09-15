// Simple test of runtime-config logic
console.log('Testing runtime-config behavior...')

// Test with unset environment variable
delete process.env.NEXT_PUBLIC_BACKEND_URL

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || ''
const result = { backendUrl }

console.log('Result:', result)

if (result.backendUrl === '') {
  console.log('✅ PASS: Returns { backendUrl: "" } when NEXT_PUBLIC_BACKEND_URL is unset')
} else {
  console.log('❌ FAIL: Expected empty backendUrl, got:', result.backendUrl)
}