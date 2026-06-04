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
}

export default function FavoritesPage() {
  const [user, setUser] = useState<User | null>(null)
  const [artists, setArtists] = useState<Artist[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')

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
      setArtists(Array.isArray(approvedArtists) ? approvedArtists.filter(a => favoriteIds.has(a.id)) : [])
      setLoading(false)
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)', color: 'var(--muted)' }}>
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
          <Link className="inline-block font-bold px-6 py-3 rounded-xl" style={{ background: 'var(--primary)', color: 'var(--on-primary)' }} href="/">
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
          <Link className="inline-block font-bold px-6 py-3 rounded-xl" style={{ background: 'var(--primary)', color: 'var(--on-primary)' }} href="/connexion">
            Se connecter
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 sm:p-8" style={{ background: 'var(--bg)' }}>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Mes favoris</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>{artists.length} artiste{artists.length !== 1 ? 's' : ''}</p>
          </div>
          <Link href="/" className="font-bold px-4 py-2 rounded-xl" style={{ background: 'var(--primary)', color: 'var(--on-primary)' }}>
            Globe
          </Link>
        </div>

        {error && <p className="rounded-xl p-4 mb-4 text-sm" style={{ background: 'var(--surface)', color: '#f87171', border: '1px solid var(--border)' }}>{error}</p>}

        {!error && artists.length === 0 && (
          <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p style={{ color: 'var(--muted)' }}>Aucun favori pour le moment.</p>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {artists.map(artist => (
            <div key={artist.id} className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="flex gap-3">
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
                <audio controls className="w-full h-8 rounded-lg mt-3" src={artist.deezer_preview_url} />
              )}
              <button
                onClick={() => removeFavorite(artist.id)}
                className="mt-3 text-sm font-semibold"
                style={{ color: 'var(--muted)' }}
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
