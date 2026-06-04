'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { hasSupabasePublicConfig, supabase } from '@/lib/supabase'
import { GENRE_COLORS } from '@/lib/genres'

interface Artist {
  id: string
  name: string
  song_name: string
  country_name: string
  genre: string
  deezer_artist_image?: string
  deezer_preview_url?: string
  deezer_track_id?: string
}
export default function FavoritesPage() {
  const [user, setUser] = useState<User | null>(null)
  const [artists, setArtists] = useState<Artist[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [spotifyLoading, setSpotifyLoading] = useState(false)
  const [spotifyMessage, setSpotifyMessage] = useState('')
  const [spotifyCooldownUntil, setSpotifyCooldownUntil] = useState(0)
  const [showSpotifySearch, setShowSpotifySearch] = useState(false)
  const spotifyCooldownActive = spotifyCooldownUntil > Date.now()

  const formatWait = (seconds: number) => {
    if (seconds >= 3600) {
      const hours = Math.ceil(seconds / 3600)
      return `${hours} heure${hours !== 1 ? 's' : ''}`
    }

    const minutes = Math.max(1, Math.ceil(seconds / 60))
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`
  }

  const exportToSpotify = async (favoriteArtists = artists, allowLoginRedirect = true) => {
    if (favoriteArtists.length === 0) return
    const cooldownRemaining = Math.ceil((spotifyCooldownUntil - Date.now()) / 1000)
    if (cooldownRemaining > 0) {
      setSpotifyMessage(`Spotify limite temporairement les requetes. Reessayez dans ${formatWait(cooldownRemaining)}.`)
      return
    }

    setSpotifyLoading(true)
    setSpotifyMessage('')

    const res = await fetch('/api/spotify/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artists: favoriteArtists }),
    })

    if (res.status === 401) {
      if (!allowLoginRedirect) {
        setSpotifyLoading(false)
        sessionStorage.removeItem('spotify_export_pending')
        setSpotifyMessage('Spotify demande une nouvelle autorisation. Cliquez une fois sur Spotify pour relancer la connexion.')
        return
      }

      sessionStorage.setItem('spotify_export_pending', '1')
      window.location.href = '/api/spotify/login?export=1'
      return
    }

    const data = await res.json()

    if (!res.ok) {
      setSpotifyLoading(false)
      if (data.error === 'missing_config') {
        setSpotifyMessage('Spotify doit être configuré avant de pouvoir créer la playlist.')
      } else if (data.error === 'no_favorites') {
        setSpotifyMessage('Ajoutez au moins un favori avant de créer une playlist.')
      } else if (data.status === 429) {
        const retryAfter = Number(data.retryAfter || 60)
        const cooldownUntil = Date.now() + retryAfter * 1000
        setSpotifyCooldownUntil(cooldownUntil)
        localStorage.setItem('spotify_cooldown_until', String(cooldownUntil))
        setSpotifyMessage(`Spotify limite temporairement les requetes. Reessayez dans ${formatWait(retryAfter)}.`)
      } else {
        const detail = data.status ? ` Spotify a repondu ${data.status}.` : ''
        setSpotifyMessage(`Impossible de creer la playlist Spotify pour le moment.${detail}`)
      }
      return
    }

    setSpotifyLoading(false)
    setSpotifyMessage(`${data.added} titre${data.added !== 1 ? 's' : ''} ajouté${data.added !== 1 ? 's' : ''}.`)

    const already = data.alreadyAdded ? ` ${data.alreadyAdded} deja present${data.alreadyAdded !== 1 ? 's' : ''}.` : ''
    setSpotifyMessage(`${data.added} titre${data.added !== 1 ? 's' : ''} ajoute${data.added !== 1 ? 's' : ''} aux Titres likes.${already}`)
    const addedCount = Number(data.added || 0)
    const alreadyCount = Number(data.alreadyAdded || 0)
    const missingCount = Array.isArray(data.missing) ? data.missing.length : 0

    if (addedCount === 0 && alreadyCount > 0) {
      setSpotifyMessage(`Tous les titres trouves sont deja dans tes Titres likes. ${missingCount ? `${missingCount} introuvable${missingCount !== 1 ? 's' : ''}.` : ''}`)
    } else if (addedCount === 0 && missingCount > 0) {
      setSpotifyMessage(`Aucun nouveau titre ajoute. ${missingCount} titre${missingCount !== 1 ? 's' : ''} introuvable${missingCount !== 1 ? 's' : ''} sur Spotify.`)
    } else {
      const alreadyMessage = alreadyCount ? ` ${alreadyCount} deja present${alreadyCount !== 1 ? 's' : ''}.` : ''
      const missingMessage = missingCount ? ` ${missingCount} introuvable${missingCount !== 1 ? 's' : ''}.` : ''
      setSpotifyMessage(`${addedCount} titre${addedCount !== 1 ? 's' : ''} ajoute${addedCount !== 1 ? 's' : ''} aux Titres likes.${alreadyMessage}${missingMessage}`)
    }
  }

  useEffect(() => {
    const savedCooldown = Number(localStorage.getItem('spotify_cooldown_until') || 0)
    if (savedCooldown > Date.now()) {
      setSpotifyCooldownUntil(savedCooldown)
    }

    const load = async () => {
      setLoading(true)
      setError('')
      const spotifyStatus = new URLSearchParams(window.location.search).get('spotify')

      if (spotifyStatus === 'auth-error') {
        sessionStorage.removeItem('spotify_export_pending')
        setSpotifyMessage('Connexion Spotify interrompue. Relancez Spotify depuis le bouton quand vous voulez reessayer.')
        window.history.replaceState({}, '', '/favoris')
      } else if (spotifyStatus === 'missing-config') {
        sessionStorage.removeItem('spotify_export_pending')
        setSpotifyMessage('Spotify doit etre configure avant de pouvoir creer la playlist.')
        window.history.replaceState({}, '', '/favoris')
      }

      if (!hasSupabasePublicConfig()) {
        setError('Connexion indisponible: ajoutez NEXT_PUBLIC_SUPABASE_ANON_KEY dans les variables d’environnement.')
        setLoading(false)
        return
      }

      const supabaseClient = supabase()

      const { data: sessionData } = await supabaseClient.auth.getSession()
      const currentUser = sessionData.session?.user ?? null
      setUser(currentUser)

      if (!currentUser) {
        setArtists([])
        setLoading(false)
        return
      }

      const { data: favoriteRows, error: favoriteError } = await supabaseClient
        .from('favorites')
        .select('artist_id')
        .eq('user_id', currentUser.id)

      if (favoriteError) {
        setError('Les favoris ne sont pas encore configurés côté Supabase.')
        setLoading(false)
        return
      }

      const favoriteIds = new Set((favoriteRows || []).map(row => row.artist_id as string))
      const approvedArtists = await fetch('/api/submit').then(r => r.json())
      const nextArtists = Array.isArray(approvedArtists) ? approvedArtists.filter(a => favoriteIds.has(a.id)) : []
      setArtists(nextArtists)
      setLoading(false)

      const shouldExportToSpotify =
        spotifyStatus === 'connected' &&
        (sessionStorage.getItem('spotify_export_pending') === '1' ||
          new URLSearchParams(window.location.search).get('export') === '1')

      if (shouldExportToSpotify) {
        sessionStorage.removeItem('spotify_export_pending')
        window.history.replaceState({}, '', '/favoris')
        setShowSpotifySearch(true)
        setSpotifyMessage('Export automatique Spotify desactive. Utilisez les boutons de recherche Spotify ci-dessous.')
      }
    }

    load()
  }, [])

  const removeFavorite = async (artistId: string) => {
    if (!user) return
    if (!hasSupabasePublicConfig()) return
    const supabaseClient = supabase()
    await supabaseClient.from('favorites').delete().eq('user_id', user.id).eq('artist_id', artistId)
    setArtists(current => current.filter(artist => artist.id !== artistId))
  }

  const spotifySearchUrl = (artist: Artist) => {
    return `https://open.spotify.com/search/${encodeURIComponent(`${artist.name} ${artist.song_name}`)}`
  }

  const spotifyAppSearchUrl = (artist: Artist) => {
    return `spotify:search:${encodeURIComponent(`${artist.name} ${artist.song_name}`)}`
  }

  const openSpotifySearch = (artist: Artist) => {
    window.location.href = spotifyAppSearchUrl(artist)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 text-center" style={{ background: 'var(--bg)', color: 'var(--muted)' }}>
        Chargement des favoris...
      </div>
    )
  }

  if (error && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
        <div className="max-w-md text-center rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h1 className="text-2xl font-bold mb-3" style={{ color: 'var(--text)' }}>Mes favoris</h1>
          <p className="text-sm mb-5" style={{ color: '#f87171' }}>{error}</p>
          <Link className="tap-target inline-flex items-center justify-center font-bold px-6 py-3 rounded-xl" style={{ background: 'var(--primary)', color: 'var(--on-primary)' }} href="/">
            Retour au globe
          </Link>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
        <div className="max-w-md text-center rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h1 className="text-2xl font-bold mb-3" style={{ color: 'var(--text)' }}>Mes favoris</h1>
          <p className="text-sm mb-5" style={{ color: 'var(--muted)' }}>
            Connectez-vous pour retrouver vos artistes favoris.
          </p>
          <Link className="tap-target inline-flex items-center justify-center font-bold px-6 py-3 rounded-xl" style={{ background: 'var(--primary)', color: 'var(--on-primary)' }} href="/connexion">
            Se connecter
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-3 sm:p-8" style={{ background: 'var(--bg)' }}>
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Mes favoris</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>{artists.length} artiste{artists.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex">
            <button
              onClick={() => {
                setShowSpotifySearch(current => !current)
                setSpotifyMessage('')
              }}
              disabled={artists.length === 0}
              className="tap-target font-bold px-4 py-3 rounded-xl flex items-center justify-center"
              style={{
                background: artists.length > 0 ? '#1db954' : 'var(--surface2)',
                color: artists.length > 0 ? '#06140b' : 'var(--muted2)',
                opacity: spotifyLoading ? 0.7 : 1,
              }}
              type="button"
            >
              Spotify
            </button>
            <Link href="/" className="tap-target font-bold px-4 py-3 rounded-xl flex items-center justify-center" style={{ background: 'var(--primary)', color: 'var(--on-primary)' }}>
              Globe
            </Link>
          </div>
        </div>

        {error && <p className="rounded-xl p-4 mb-4 text-sm" style={{ background: 'var(--surface)', color: '#f87171', border: '1px solid var(--border)' }}>{error}</p>}
        {spotifyMessage && <p className="rounded-xl p-4 mb-4 text-sm" style={{ background: 'var(--surface)', color: 'var(--muted)', border: '1px solid var(--border)' }}>{spotifyMessage}</p>}

        {showSpotifySearch && artists.length > 0 && (
          <div className="rounded-2xl p-4 mb-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="grid gap-2">
              {artists.map(artist => (
                <div key={`spotify-${artist.id}`} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl p-3" style={{ background: 'var(--surface2)' }}>
                  <div className="min-w-0 w-full">
                    <p className="font-bold truncate" style={{ color: 'var(--text)' }}>{artist.name}</p>
                    <p className="text-sm truncate" style={{ color: 'var(--muted)' }}>{artist.song_name}</p>
                  </div>
                  <button
                    className="tap-target font-bold px-3 py-3 rounded-xl text-sm shrink-0 w-full sm:w-auto"
                    onClick={() => openSpotifySearch(artist)}
                    style={{ background: '#1db954', color: '#06140b' }}
                    type="button"
                  >
                    Chercher
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {!error && artists.length === 0 && (
          <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p style={{ color: 'var(--muted)' }}>Aucun favori pour le moment.</p>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {artists.map(artist => (
            <div key={artist.id} className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="flex gap-3 min-w-0">
                {artist.deezer_artist_image && (
                  <img src={artist.deezer_artist_image} alt={artist.name} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="font-bold truncate" style={{ color: GENRE_COLORS[artist.genre] || 'var(--text)' }}>{artist.name}</h2>
                  <p className="text-sm truncate" style={{ color: 'var(--text)' }}>♪ {artist.song_name}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{artist.country_name} · {artist.genre}</p>
                </div>
              </div>
              {artist.deezer_preview_url && (
                <audio controls className="w-full h-10 rounded-lg mt-3" src={artist.deezer_preview_url} />
              )}
              <button
                onClick={() => removeFavorite(artist.id)}
                className="tap-target mt-3 text-sm font-semibold w-full sm:w-auto rounded-xl px-3 py-3"
                style={{ color: 'var(--muted)', background: 'var(--surface2)', border: '1px solid var(--border)' }}
                type="button"
              >
                Retirer des favoris
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}



