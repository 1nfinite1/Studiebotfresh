export async function GET() {
  return Response.json({ message: 'Test API working' })
}

export async function POST() {
  return Response.json({ message: 'Test POST working' })
}