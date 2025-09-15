export const dynamic = 'force-dynamic'

export async function GET() {
  return Response.json(
    { backendUrl: process.env.NEXT_PUBLIC_BACKEND_URL || '' },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}