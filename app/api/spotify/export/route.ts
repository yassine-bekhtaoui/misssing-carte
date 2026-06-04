import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

interface ExportArtist {
  id: string
  name: string
  song_name: string
  deezer_track_id?: string
}

const SPOTIFY_API = 'https://api.spotify.com/v1'

async function spotifyFetch(path: string, token: string, init: RequestInit = {}) {
  return fetch(`${SPOTIFY_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
}

function uniqueValues(values: string[]) {
  return [...new Set(values)]
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('spotify_access_token')?.value

  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    return NextResponse.json({ error: 'missing_config' }, { status: 400 })
  }

  if (!token) {
    return NextResponse.json({ error: 'spotify_not_connected' }, { status: 401 })
  }

  const body = await req.json()
  const artists: ExportArtist[] = Array.isArray(body.artists) ? body.artists : []
  if (artists.length === 0) {
    return NextResponse.json({ error: 'no_favorites' }, { status: 400 })
  }

  const meRes = await spotifyFetch('/me', token)
  if (!meRes.ok) {
    return NextResponse.json({ error: 'spotify_not_connected' }, { status: 401 })
  }
  const me = await meRes.json()

  const playlistRes = await spotifyFetch(`/users/${me.id}/playlists`, token, {
    method: 'POST',
    body: JSON.stringify({
      name: "MISS'SING - Mes favoris",
      description: "Playlist créée depuis mes favoris MISS'SING.",
      public: false,
    }),
  })

  if (!playlistRes.ok) {
    return NextResponse.json({ error: 'playlist_failed' }, { status: 500 })
  }

  const playlist = await playlistRes.json()
  const foundUris: string[] = []
  const missing: ExportArtist[] = []

  for (const artist of artists) {
    const q = encodeURIComponent(`track:${artist.song_name} artist:${artist.name}`)
    const searchRes = await spotifyFetch(`/search?type=track&limit=1&q=${q}`, token)
    if (!searchRes.ok) {
      missing.push(artist)
      continue
    }

    const search = await searchRes.json()
    const uri = search.tracks?.items?.[0]?.uri
    if (uri) foundUris.push(uri)
    else missing.push(artist)
  }

  const uris = uniqueValues(foundUris)
  if (uris.length > 0) {
    const addRes = await spotifyFetch(`/playlists/${playlist.id}/tracks`, token, {
      method: 'POST',
      body: JSON.stringify({ uris }),
    })

    if (!addRes.ok) {
      return NextResponse.json({ error: 'add_tracks_failed' }, { status: 500 })
    }
  }

  return NextResponse.json({
    playlistUrl: playlist.external_urls?.spotify,
    playlistUri: playlist.uri,
    added: uris.length,
    missing: missing.map(artist => ({ name: artist.name, song_name: artist.song_name })),
  })
}
