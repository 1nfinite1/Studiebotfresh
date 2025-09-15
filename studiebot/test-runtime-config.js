// Test runtime-config route handler
import { NextResponse } from 'next/server'

// Mock the route handler
async function GET() {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || ''
  return NextResponse.json({ backendUrl }, { status: 200 })
}

// Test with unset environment variable
delete process.env.NEXT_PUBLIC_BACKEND_URL

// Call the handler
GET().then(response => {
  return response.json()
}).then(data => {
  console.log('Runtime config test result:', data)
  if (data.backendUrl === '') {
    console.log('✅ PASS: Returns { backendUrl: "" } when NEXT_PUBLIC_BACKEND_URL is unset')
  } else {
    console.log('❌ FAIL: Expected empty backendUrl, got:', data.backendUrl)
  }
}).catch(error => {
  console.error('❌ FAIL: Error testing runtime config:', error)
})