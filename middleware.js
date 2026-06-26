import { NextResponse } from 'next/server'

const PASSWORD_COOKIE = 'site-auth'

export function middleware(request) {
  const { pathname } = request.nextUrl

  // Skip password wall for the login page, all API routes, and static assets
  if (
    pathname === '/login' ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next()
  }

  const authCookie = request.cookies.get(PASSWORD_COOKIE)
  if (authCookie?.value === 'authenticated') {
    // Allow through but delete the cookie so next page load requires password again
    const response = NextResponse.next()
    response.cookies.delete(PASSWORD_COOKIE)
    return response
  }

  const loginUrl = new URL('/login', request.url)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
