import type { NextRequest } from 'next/server'

export function spotifyRedirectUri(req: NextRequest) {
  const host = req.headers.get('host') || req.nextUrl.host

  if (host.startsWith('localhost')) {
    return `${req.nextUrl.protocol}//127.0.0.1:${req.nextUrl.port || '3000'}/api/spotify/callback`
  }

  return `${req.nextUrl.protocol}//${host}/api/spotify/callback`
}
