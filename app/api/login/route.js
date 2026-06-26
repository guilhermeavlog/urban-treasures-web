import { NextResponse } from 'next/server'

export async function POST(request) {
  const { password } = await request.json()

  if (password === process.env.SITE_PASSWORD) {
    const response = NextResponse.json({ success: true })
    response.cookies.set('site-auth', 'authenticated', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60, // short-lived — middleware deletes it after first use
    })
    return response
  }

  return NextResponse.json({ success: false, error: 'Wrong password' }, { status: 401 })
}
