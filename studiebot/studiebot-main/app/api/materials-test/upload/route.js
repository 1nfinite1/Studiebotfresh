import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    console.log('Upload route called')
    
    const form = await request.formData().catch(() => null)
    if (!form) {
      return NextResponse.json({ error: 'Invalid multipart/form-data' }, { status: 400 })
    }
    
    const file = form.get('file')
    const vak = String(form.get('vak') || '')
    const leerjaar = String(form.get('leerjaar') || '')
    const hoofdstuk = String(form.get('hoofdstuk') || '')
    const uploader = String(form.get('uploader') || 'onbekend')
    
    console.log('Form data:', { vak, leerjaar, hoofdstuk, uploader })
    console.log('File:', file ? file.name : 'No file')
    
    return NextResponse.json({ 
      success: true,
      message: 'Test upload route working',
      data: { vak, leerjaar, hoofdstuk, uploader, filename: file?.name }
    })
  } catch (error) {
    console.error('Upload test error:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error.message 
    }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { 
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  })
}