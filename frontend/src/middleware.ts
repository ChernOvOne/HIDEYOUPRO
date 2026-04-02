import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('token')?.value

  // Public paths — always allow
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/setup') ||
    pathname.startsWith('/api') ||       // Backend handles its own auth
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/present') ||
    pathname.startsWith('/privacy') ||
    pathname.startsWith('/terms') ||
    pathname === '/'
  ) {
    return NextResponse.next()
  }

  // No token → go to login
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Has token → allow
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
