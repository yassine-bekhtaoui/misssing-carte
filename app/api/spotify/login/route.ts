import { NextRequest, NextResponse } from 'next/server'
import { spotifyAppOrigin, spotifyRedirectUri } from '@/lib/spotify'

const SPOTIFY_AUTHORIZE_URL = 'https://accounts.spotify.com/authorize'
const SCOPES = ['playlist-modify-private', 'playlist-modify-public', 'playlist-read-private'].join(' ')

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
    return NextResponse.redirect(new URL('/favoris?spotify=missing-config', spotifyAppOrigin(req)))
  }

  const state = randomState()
  const redirectUri = spotifyRedirectUri(req)
  const response = NextResponse.redirect(`${SPOTIFY_AUTHORIZE_URL}?${new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: SCOPES,
    redirect_uri: redirectUri,
    state,
  }).toString()}`)

  response.cookies.set('spotify_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.nextUrl.protocol === 'https:',
    path: '/',
    maxAge: 600,
  })

  if (req.nextUrl.searchParams.get('export') === '1') {
    response.cookies.set('spotify_export_pending', '1', {
      httpOnly: true,
      sameSite: 'lax',
      secure: req.nextUrl.protocol === 'https:',
      path: '/',
      maxAge: 600,
    })
  }

  return response
}
