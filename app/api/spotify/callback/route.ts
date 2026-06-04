import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { spotifyAppOrigin, spotifyRedirectUri } from '@/lib/spotify'

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const cookieStore = await cookies()
  const savedState = cookieStore.get('spotify_oauth_state')?.value
  const shouldExport = cookieStore.get('spotify_export_pending')?.value === '1'
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET

  if (!code || !state || !savedState || state !== savedState || !clientId || !clientSecret) {
    return NextResponse.redirect(new URL('/favoris?spotify=auth-error', spotifyAppOrigin(req)))
  }

  const redirectUri = spotifyRedirectUri(req)
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const tokenRes = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  })

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL('/favoris?spotify=auth-error', spotifyAppOrigin(req)))
  }

  const token = await tokenRes.json()
  const nextPath = shouldExport ? '/favoris?spotify=connected&export=1' : '/favoris?spotify=connected'
  const response = NextResponse.redirect(new URL(nextPath, spotifyAppOrigin(req)))

  response.cookies.delete('spotify_oauth_state')
  response.cookies.delete('spotify_export_pending')
  response.cookies.set('spotify_access_token', token.access_token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.nextUrl.protocol === 'https:',
    path: '/',
    maxAge: Math.max(60, Number(token.expires_in || 3600) - 60),
  })

  return response
}
