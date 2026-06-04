import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { spotifyRedirectUri } from '@/lib/spotify'

const SPOTIFY_AUTHORIZE_URL = 'https://accounts.spotify.com/authorize'
const SCOPES = ['playlist-modify-private', 'playlist-modify-public'].join(' ')

function randomState() {
  return crypto.randomUUID()
}

export async function GET(req: NextRequest) {
  const host = req.headers.get('host') || req.nextUrl.host

  if (host.startsWith('localhost')) {
    const localUrl = new URL(req.nextUrl.pathname + req.nextUrl.search, req.nextUrl.href)
    localUrl.hostname = '127.0.0.1'
    return NextResponse.redirect(localUrl)
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID

  if (!clientId) {
    return NextResponse.redirect(new URL('/favoris?spotify=missing-config', req.nextUrl.origin))
  }

  const state = randomState()
  const redirectUri = spotifyRedirectUri(req)
  const cookieStore = await cookies()
  cookieStore.set('spotify_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.nextUrl.protocol === 'https:',
    path: '/',
    maxAge: 600,
  })

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: SCOPES,
    redirect_uri: redirectUri,
    state,
  })

  return NextResponse.redirect(`${SPOTIFY_AUTHORIZE_URL}?${params.toString()}`)
}
