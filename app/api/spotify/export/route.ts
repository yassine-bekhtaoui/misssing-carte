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

function normalizeValue(value?: string) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

function trackScore(track: any, artist: ExportArtist) {
  const wantedTitle = normalizeValue(artist.song_name)
  const wantedArtist = normalizeValue(artist.name)
  const trackTitle = normalizeValue(track?.name)
  const trackArtists = (track?.artists || []).map((item: any) => normalizeValue(item?.name))

  let score = 0
  if (trackTitle === wantedTitle) score += 8
  else if (trackTitle.includes(wantedTitle) || wantedTitle.includes(trackTitle)) score += 4

  if (trackArtists.some((name: string) => name === wantedArtist)) score += 8
  else if (trackArtists.some((name: string) => name.includes(wantedArtist) || wantedArtist.includes(name))) score += 4

  return score
}

async function searchSpotifyTrack(token: string, artist: ExportArtist) {
  const queries = [
    `track:${artist.song_name} artist:${artist.name}`,
    `${artist.song_name} ${artist.name}`,
    `track:${artist.song_name}`,
    artist.song_name,
  ]

  for (const query of queries) {
    const q = encodeURIComponent(query)
    const searchRes = await spotifyFetch(`/search?type=track&limit=5&market=from_token&q=${q}`, token)
    if (!searchRes.ok) return { error: searchRes }

    const search = await searchRes.json()
    const tracks = search.tracks?.items || []
    const bestTrack = tracks
      .filter((track: any) => track?.id && track?.uri)
      .sort((a: any, b: any) => trackScore(b, artist) - trackScore(a, artist))[0]

    if (bestTrack?.id && bestTrack?.uri) {
      return { track: { id: bestTrack.id, uri: bestTrack.uri } }
    }
  }

  return { track: null }
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
    const result = await searchSpotifyTrack(token, artist)
    if (result.error) {
      missing.push(artist)
      continue
    }

    const track = result.track
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
