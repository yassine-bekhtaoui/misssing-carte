import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

interface ExportArtist {
  id: string
  name: string
  song_name: string
  deezer_track_id?: string
}

interface SpotifyTrackCandidate {
  uri: string
  key: string
}

const SPOTIFY_API = 'https://api.spotify.com/v1'
const PLAYLIST_NAME = "MISS'SING - Mes favoris"

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

function uniqueValues(values: string[]) {
  return [...new Set(values)]
}

function normalizeValue(value?: string) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

function trackKey(trackName?: string, artistNames: string[] = []) {
  return `${normalizeValue(trackName)}::${artistNames.map(normalizeValue).sort().join('|')}`
}

async function getExistingPlaylist(token: string, userId: string) {
  let nextPath: string | null = '/me/playlists?limit=50'

  while (nextPath) {
    const playlistsRes = await spotifyFetch(nextPath, token)
    if (!playlistsRes.ok) return { error: playlistsRes }

    const playlists = await playlistsRes.json()
    const playlist = playlists.items?.find((item: any) => item?.name === PLAYLIST_NAME && item?.owner?.id === userId)
    if (playlist) return { playlist }

    nextPath = playlists.next ? playlists.next.replace(SPOTIFY_API, '') : null
  }

  return { playlist: null }
}

async function getPlaylistTracks(token: string, playlistId: string) {
  const uris = new Set<string>()
  const keys = new Set<string>()
  let nextPath: string | null = `/playlists/${playlistId}/tracks?limit=100`

  while (nextPath) {
    const itemsRes = await spotifyFetch(nextPath, token)
    if (!itemsRes.ok) return { error: itemsRes }

    const items = await itemsRes.json()
    for (const item of items.items || []) {
      if (item?.track?.uri) uris.add(item.track.uri)
      if (item?.track?.name) {
        keys.add(trackKey(item.track.name, (item.track.artists || []).map((artist: any) => artist.name)))
      }
    }

    nextPath = items.next ? items.next.replace(SPOTIFY_API, '') : null
  }

  return { uris, keys }
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
    return spotifyError(meRes, 'spotify_not_connected')
  }
  const me = await meRes.json()

  const existingPlaylist = await getExistingPlaylist(token, me.id)
  if (existingPlaylist.error) {
    if ([401, 403].includes(existingPlaylist.error.status)) {
      return NextResponse.json({ error: 'spotify_not_connected' }, { status: 401 })
    }
    return spotifyError(existingPlaylist.error, 'playlist_lookup_failed')
  }

  let playlist = existingPlaylist.playlist
  if (!playlist) {
    const playlistRes = await spotifyFetch('/me/playlists', token, {
    method: 'POST',
    body: JSON.stringify({
      name: "MISS'SING - Mes favoris",
      description: "Playlist créée depuis mes favoris MISS'SING.",
      public: false,
    }),
  })

    if (!playlistRes.ok) {
      return spotifyError(playlistRes, 'playlist_failed')
    }

    playlist = await playlistRes.json()
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
    const uri = track?.uri
    if (uri) {
      foundTracks.push({
        uri,
        key: trackKey(track.name, (track.artists || []).map((artist: any) => artist.name)),
      })
    }
    else missing.push(artist)
  }

  const uniqueTracks = foundTracks.filter((track, index, list) => {
    return list.findIndex(candidate => candidate.uri === track.uri || candidate.key === track.key) === index
  })

  const playlistTracks = await getPlaylistTracks(token, playlist.id)
  if (playlistTracks.error) {
    if ([401, 403].includes(playlistTracks.error.status)) {
      return NextResponse.json({ error: 'spotify_not_connected' }, { status: 401 })
    }
    return spotifyError(playlistTracks.error, 'playlist_tracks_failed')
  }

  const existingUris = playlistTracks.uris || new Set<string>()
  const existingKeys = playlistTracks.keys || new Set<string>()
  const tracksToAdd = uniqueTracks.filter(track => !existingUris.has(track.uri) && !existingKeys.has(track.key))
  const urisToAdd = tracksToAdd.map(track => track.uri)

  for (let i = 0; i < urisToAdd.length; i += 100) {
    const addRes = await spotifyFetch(`/playlists/${playlist.id}/items`, token, {
      method: 'POST',
      body: JSON.stringify({ uris: urisToAdd.slice(i, i + 100) }),
    })

    if (!addRes.ok) {
      return spotifyError(addRes, 'add_tracks_failed')
    }
  }

  return NextResponse.json({
    playlistUrl: playlist.external_urls?.spotify,
    playlistUri: playlist.uri,
    added: urisToAdd.length,
    alreadyAdded: uniqueTracks.length - urisToAdd.length,
    missing: missing.map(artist => ({ name: artist.name, song_name: artist.song_name })),
  })
}
