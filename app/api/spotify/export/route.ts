import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

interface ExportArtist {
  id: string
  name: string
  song_name: string
  deezer_track_id?: string
}

interface SpotifyTrackCandidate {
  id: string
  uri: string
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

async function spotifyError(res: Response, error: string) {
  const detail = await res.text().catch(() => '')
  return NextResponse.json(
    {
      error,
      status: res.status,
      detail: detail.slice(0, 500),
    },
    { status: res.status >= 400 && res.status < 600 ? res.status : 500 }
  )
}

function uniqueById(tracks: SpotifyTrackCandidate[]) {
  const seen = new Set<string>()
  return tracks.filter(track => {
    if (seen.has(track.id)) return false
    seen.add(track.id)
    return true
  })
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

  const foundTracks: SpotifyTrackCandidate[] = []
  const missing: ExportArtist[] = []

  for (const artist of artists) {
    const q = encodeURIComponent(`track:${artist.song_name} artist:${artist.name}`)
    const searchRes = await spotifyFetch(`/search?type=track&limit=1&q=${q}`, token)
    if (!searchRes.ok) {
      missing.push(artist)
      continue
    }

    const search = await searchRes.json()
    const track = search.tracks?.items?.[0]
    if (track?.id && track?.uri) {
      foundTracks.push({ id: track.id, uri: track.uri })
    } else {
      missing.push(artist)
    }
  }

  const tracks = uniqueById(foundTracks)
  const tracksToLike: SpotifyTrackCandidate[] = []

  for (let i = 0; i < tracks.length; i += 50) {
    const batch = tracks.slice(i, i + 50)
    const containsRes = await spotifyFetch(`/me/tracks/contains?ids=${batch.map(track => track.id).join(',')}`, token)
    if (!containsRes.ok) {
      if ([401, 403].includes(containsRes.status)) {
        return NextResponse.json({ error: 'spotify_not_connected' }, { status: 401 })
      }
      return spotifyError(containsRes, 'liked_lookup_failed')
    }

    const contains: boolean[] = await containsRes.json()
    batch.forEach((track, index) => {
      if (!contains[index]) tracksToLike.push(track)
    })
  }

  for (let i = 0; i < tracksToLike.length; i += 50) {
    const batch = tracksToLike.slice(i, i + 50)
    const addRes = await spotifyFetch('/me/tracks', token, {
      method: 'PUT',
      body: JSON.stringify({ ids: batch.map(track => track.id) }),
    })

    if (!addRes.ok) {
      if ([401, 403].includes(addRes.status)) {
        return NextResponse.json({ error: 'spotify_not_connected' }, { status: 401 })
      }
      return spotifyError(addRes, 'like_tracks_failed')
    }
  }

  return NextResponse.json({
    libraryUrl: 'https://open.spotify.com/collection/tracks',
    libraryUri: 'spotify:collection:tracks',
    found: tracks.length,
    added: tracksToLike.length,
    alreadyAdded: tracks.length - tracksToLike.length,
    missing: missing.map(artist => ({ name: artist.name, song_name: artist.song_name })),
  })
}
