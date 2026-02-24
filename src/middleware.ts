import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  const res = NextResponse.next()

  // Security headers
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('X-XSS-Protection', '1; mode=block')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

  // CORS for API routes — allow any origin (it's a public API)
  if (req.nextUrl.pathname.startsWith('/api/')) {
    res.headers.set('Access-Control-Allow-Origin', '*')
    res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, x-api-key')

    // Handle preflight
    if (req.method === 'OPTIONS') {
      return new NextResponse(null, { status: 204, headers: res.headers })
    }

    // Reject absurdly large payloads early (100KB)
    const contentLength = req.headers.get('content-length')
    if (contentLength && parseInt(contentLength) > 100_000) {
      return NextResponse.json(
        { error: 'Payload too large. Max 100KB.' },
        { status: 413 }
      )
    }
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
