'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { GENRE_COLORS } from '@/lib/genres'
import { hasSupabasePublicConfig, supabase } from '@/lib/supabase'

const CONTINENTS = [
  { name: 'EUROPE',    lat: 54,  lng: 15  },
  { name: 'AFRIQUE',   lat: 5,   lng: 20  },
  { name: 'ASIE',      lat: 40,  lng: 95  },
  { name: 'AMÉRIQUES', lat: 10,  lng: -80 },
  { name: 'OCÉANIE',   lat: -25, lng: 133 },
]

interface Artist {
  id: string
  name: string
  song_name: string
  country_code: string
  country_name: string
  genre: string
  lat: number
  lng: number
  deezer_artist_image?: string
  deezer_preview_url?: string
  reason?: string
  submitted_by?: string
}

interface CountryGroup {
  name: string
  artists: Artist[]
  lat: number
  lng: number
}

function applyGlobeMotionLock(globe: any) {
  const controls = globe.controls()
  controls.autoRotate = false
  controls.autoRotateSpeed = 0
  controls.enableDamping = false
  controls.dampingFactor = 0
}

function lockGlobeMotion(globe: any) {
  const controls = globe.controls()

  const stopAutomaticMotion = () => {
    applyGlobeMotionLock(globe)
  }

  controls.addEventListener?.('start', stopAutomaticMotion)
  controls.addEventListener?.('change', stopAutomaticMotion)
  controls.addEventListener?.('end', stopAutomaticMotion)
  applyGlobeMotionLock(globe)

  return () => {
    controls.removeEventListener?.('start', stopAutomaticMotion)
    controls.removeEventListener?.('change', stopAutomaticMotion)
    controls.removeEventListener?.('end', stopAutomaticMotion)
  }
}

export default function Globe() {
  const router = useRouter()
  const mountRef  = useRef<HTMLDivElement>(null)
  const globeRef  = useRef<any>(null)
  const artistsSignatureRef = useRef('')
  const pointOfViewRef = useRef<{ lat: number; lng: number; altitude: number } | null>(null)
  const onCountryClickRef = useRef<(g: CountryGroup) => void>(() => {})

  const [artists,         setArtists]         = useState<Artist[]>([])
  const [tooltip,         setTooltip]         = useState<Artist | null>(null)
  const [loading,         setLoading]         = useState(true)
  const [selectedCountry, setSelectedCountry] = useState<CountryGroup | null>(null)
  const [showGenrePanel,  setShowGenrePanel]  = useState(false)
  const [panelGenre,      setPanelGenre]      = useState<string | null>(null)
  const [user,            setUser]            = useState<User | null>(null)
  const [favoriteIds,     setFavoriteIds]     = useState<Set<string>>(new Set())
  const [favoriteBusy,    setFavoriteBusy]    = useState(false)

  onCountryClickRef.current = setSelectedCountry

  // ── fetch / refresh ────────────────────────────────────────────────────────
  const fetchArtists = useCallback(() => {
    fetch('/api/submit')
      .then(r => r.json())
      .then(data => {
        const nextArtists = Array.isArray(data) ? data : []
        const nextSignature = JSON.stringify(nextArtists.map(a => ({
          id: a.id,
          name: a.name,
          song_name: a.song_name,
          country_code: a.country_code,
          genre: a.genre,
          status: a.status,
          reviewed_at: a.reviewed_at,
        })))
        if (nextSignature !== artistsSignatureRef.current) {
          artistsSignatureRef.current = nextSignature
          setArtists(nextArtists)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchArtists()
    // Rafraîchit quand on revient sur la page (retour depuis admin)
    window.addEventListener('focus', fetchArtists)
    const iv = setInterval(fetchArtists, 30_000)
    return () => {
      window.removeEventListener('focus', fetchArtists)
      clearInterval(iv)
    }
  }, [fetchArtists])

  useEffect(() => {
    if (!hasSupabasePublicConfig()) return
    const supabaseClient = supabase()
    supabaseClient.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
    })

    const { data } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!hasSupabasePublicConfig()) return
    if (!user) {
      setFavoriteIds(new Set())
      return
    }

    const supabaseClient = supabase()
    supabaseClient
      .from('favorites')
      .select('artist_id')
      .eq('user_id', user.id)
      .then(({ data, error }) => {
        if (!error) setFavoriteIds(new Set((data || []).map(row => row.artist_id as string)))
      })
  }, [user])

  // ── globe ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mountRef.current || loading) return

    const filtered = artists

    // Group by country
    const byCountry = new Map<string, CountryGroup>()
    for (const a of filtered) {
      if (!byCountry.has(a.country_name)) {
        byCountry.set(a.country_name, { name: a.country_name, lat: a.lat, lng: a.lng, artists: [] })
      }
      byCountry.get(a.country_name)!.artists.push(a)
    }

    // ── Continent labels ──────────────────────────────────────────────────
    const continentEls = CONTINENTS.map(c => {
      const el = document.createElement('div')
      el.textContent = c.name
      el.style.cssText = [
        'color:rgba(255,255,255,0.45)',
        'font-size:11px',
        'font-weight:700',
        'letter-spacing:3px',
        'pointer-events:none',
        'white-space:nowrap',
        'text-shadow:0 1px 6px rgba(0,0,0,0.9)',
        'user-select:none',
        'transition:opacity 0.4s ease',
      ].join(';')
      return { lat: c.lat, lng: c.lng, el, type: 'continent' as const }
    })

    // ── Country cluster badges ────────────────────────────────────────────
    const countryEls = Array.from(byCountry.values()).map(group => {
      const wrapper = document.createElement('div')
      wrapper.style.cssText = [
        'display:flex',
        'flex-direction:column',
        'align-items:center',
        'gap:4px',
        'opacity:0',
        'transition:opacity 0.4s ease',
        'pointer-events:auto',
        'transform:translateZ(0)',
        '-webkit-font-smoothing:antialiased',
        'backface-visibility:hidden',
      ].join(';')

      const badge = document.createElement('div')
      badge.textContent = String(group.artists.length)
      badge.style.cssText = [
        'background:linear-gradient(135deg,#e8f000 0%,#c8d800 55%,#9dd300 100%)',
        'color:#0c0b16',
        'border-radius:999px',
        'min-width:34px',
        'height:34px',
        'padding:0 8px',
        'display:flex',
        'align-items:center',
        'justify-content:center',
        'font-size:12px',
        'font-weight:800',
        'line-height:1',
        'cursor:pointer',
        'box-shadow:0 10px 24px rgba(0,0,0,0.35),0 0 0 3px rgba(160,40,210,0.95),0 0 18px rgba(200,216,0,0.45)',
        'transition:transform 0.15s',
        'user-select:none',
        'border:1px solid rgba(255,255,255,0.45)',
        'pointer-events:auto',
        'text-rendering:geometricPrecision',
      ].join(';')

      badge.addEventListener('mouseover', () => { badge.style.transform = 'scale(1.12)' })
      badge.addEventListener('mouseout',  () => { badge.style.transform = 'scale(1)' })
      badge.addEventListener('click', e => {
        e.stopPropagation()
        setTooltip(null)
        onCountryClickRef.current(group)
      })

      const nameEl = document.createElement('div')
      nameEl.textContent = group.name
      nameEl.style.cssText = [
        'color:rgba(255,247,251,0.95)',
        'background:rgba(12,11,22,0.68)',
        'border:1px solid rgba(255,255,255,0.12)',
        'border-radius:999px',
        'padding:2px 7px',
        'font-size:10px',
        'font-weight:700',
        'line-height:1.15',
        'white-space:nowrap',
        'text-shadow:0 1px 2px rgba(0,0,0,0.9)',
        'pointer-events:none',
        'user-select:none',
        'letter-spacing:0',
        'text-rendering:geometricPrecision',
      ].join(';')

      wrapper.appendChild(badge)
      wrapper.appendChild(nameEl)
      return { lat: group.lat, lng: group.lng, el: wrapper, type: 'country' as const }
    })

    const allEls = [...continentEls, ...countryEls]

    let globe: any
    let destroyed = false
    let raf = -1
    let unlockControls = () => {}
    let removeListener = () => {}

    import('globe.gl').then(({ default: GlobeGL }) => {
      if (destroyed || !mountRef.current) return

      globe = (GlobeGL as any)()(mountRef.current!)
        .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
        .bumpImageUrl('https://unpkg.com/three-globe/example/img/earth-topology.png')
        .backgroundColor('#0c0b16')
        // ── Points artistes cliquables ──────────────────────────────────
        .pointsData(filtered)
        .pointLat('lat')
        .pointLng('lng')
        .pointColor((d: any) => GENRE_COLORS[d.genre] || '#c8d800')
        .pointRadius(0.55)
        .pointResolution(24)
        .pointAltitude(0.02)
        .pointLabel((d: any) => `
          <div style="background:rgba(8,0,6,0.9);border:1px solid ${GENRE_COLORS[d.genre] || '#c8d800'};border-radius:8px;padding:6px 10px;max-width:180px;">
            <div style="color:${GENRE_COLORS[d.genre] || '#c8d800'};font-weight:700;font-size:12px;">${d.name}</div>
            <div style="color:#fff7fb;font-size:11px;margin-top:2px;">♪ ${d.song_name}</div>
            <div style="color:#b9a6b2;font-size:10px;margin-top:2px;">📍 ${d.country_name}</div>
          </div>
        `)
        .onPointClick((d: any) => {
          const artist = d as Artist
          const countryGroup = byCountry.get(artist.country_name)
          if (countryGroup && countryGroup.artists.length > 1) {
            setTooltip(null)
            setSelectedCountry(countryGroup)
            return
          }

          setSelectedCountry(null)
          setTooltip(artist)
        })
        // ── Labels HTML continents + badges pays ────────────────────────
        .htmlElementsData(allEls)
        .htmlElement((d: any) => d.el)
        .htmlLat('lat')
        .htmlLng('lng')
        .htmlAltitude(0.01)
        .htmlTransitionDuration(0)
        .width(mountRef.current!.clientWidth)
        .height(mountRef.current!.clientHeight)

      // ── Point de vue initial centré sur le monde ───────────────────────
      const isMobile = window.innerWidth < 640
      globe.pointOfView(pointOfViewRef.current || { lat: 12, lng: 18, altitude: isMobile ? 3.65 : 2.25 }, 0)

      // ── Resize handler (orientation mobile, redimensionnement) ─────────
      const handleResize = () => {
        if (!mountRef.current || destroyed) return
        globe
          .width(mountRef.current.clientWidth)
          .height(mountRef.current.clientHeight)
        applyGlobeMotionLock(globe)
      }
      window.addEventListener('resize', handleResize)
      window.visualViewport?.addEventListener('resize', handleResize)

      unlockControls = lockGlobeMotion(globe)
      globeRef.current = globe

      // Cleanup resize listeners
      const prevRemoveListener = removeListener
      removeListener = () => {
        prevRemoveListener()
        window.removeEventListener('resize', handleResize)
        window.visualViewport?.removeEventListener('resize', handleResize)
      }

      // ── Label fading via RAF + pointOfView().altitude ──────────────────
      // altitude: ~2.5 default (far), ~0.1 very close
      // Continents: visible far, fade out when zooming in
      // Countries:  hidden far, fade in when zooming in
      const tick = () => {
        if (destroyed) return
        const alt = globe.pointOfView().altitude
        const contOp    = Math.min(1, Math.max(0, (alt - 0.6) / 0.7))   // full at alt>1.3, zero at alt<0.6
        const countryOp = Math.min(1, Math.max(0, (2.4 - alt) / 0.9))   // full at alt<1.5, zero at alt>2.4
        for (const { el, type } of allEls) {
          el.style.opacity = type === 'continent' ? String(contOp) : String(countryOp)
        }
        raf = requestAnimationFrame(tick)
      }
      tick()
    })

    return () => {
      destroyed = true
      if (globe?.pointOfView) pointOfViewRef.current = globe.pointOfView()
      unlockControls()
      removeListener()
      cancelAnimationFrame(raf)
      globeRef.current = null
      if (mountRef.current) mountRef.current.innerHTML = ''
    }
  }, [artists, loading])

  const genres = [...new Set(artists.map(a => a.genre))].sort()

  const flyToArtist = (artist: Artist) => {
    setShowGenrePanel(false)
    setPanelGenre(null)
    if (globeRef.current) {
      pointOfViewRef.current = { lat: artist.lat, lng: artist.lng, altitude: 0.55 }
      applyGlobeMotionLock(globeRef.current)
      globeRef.current.pointOfView(pointOfViewRef.current, 900)
      window.setTimeout(() => {
        if (globeRef.current) applyGlobeMotionLock(globeRef.current)
        setTooltip(artist)
      }, 950)
    } else {
      setTooltip(artist)
    }
  }

  const toggleFavorite = async (artist: Artist) => {
    if (!user) {
      router.push('/connexion')
      return
    }

    setFavoriteBusy(true)
    if (!hasSupabasePublicConfig()) {
      router.push('/connexion')
      setFavoriteBusy(false)
      return
    }
    const supabaseClient = supabase()
    const isFavorite = favoriteIds.has(artist.id)

    if (isFavorite) {
      const { error } = await supabaseClient
        .from('favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('artist_id', artist.id)

      if (!error) {
        setFavoriteIds(current => {
          const next = new Set(current)
          next.delete(artist.id)
          return next
        })
      }
    } else {
      const { error } = await supabaseClient
        .from('favorites')
        .insert({ user_id: user.id, artist_id: artist.id })

      if (!error) {
        setFavoriteIds(current => new Set(current).add(artist.id))
      }
    }

    setFavoriteBusy(false)
  }

  // ── JSX ────────────────────────────────────────────────────────────────────
  return (
    <div className="absolute inset-0" style={{ background: 'var(--bg)' }}>
      <div ref={mountRef} className="w-full h-full" />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10" style={{ background: 'var(--bg)' }}>
          <div className="text-xl animate-pulse" style={{ color: 'var(--muted)' }}>Chargement du globe…</div>
        </div>
      )}

      {/* ── Panneau recherche par genre ───────────────────────────────── */}
      {genres.length > 0 && (
        <div className="absolute top-2.5 left-2 right-2 z-20 sm:top-4 sm:left-4 sm:right-auto" style={{ width: 'min(440px, calc(100vw - 16px))' }}>
          {/* Bouton déclencheur */}
          <button
            onClick={() => {
              const next = !showGenrePanel
              setShowGenrePanel(next)
              if (!next) setPanelGenre(null)
            }}
            className="tap-target flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all w-full"
            style={{
              background:  showGenrePanel ? 'var(--primary)' : 'rgba(22,20,40,0.90)',
              color:       showGenrePanel ? 'var(--on-primary)' : 'var(--text)',
              border:      '1px solid ' + (showGenrePanel ? 'var(--primary)' : 'var(--border)'),
              backdropFilter: 'blur(8px)',
            }}
          >
            <span>🎵</span>
            <span className="flex-1 text-left">Rechercher par genre</span>
            <span className="text-xs opacity-60">{showGenrePanel ? '▲' : '▾'}</span>
          </button>

          {/* Panneau */}
          {showGenrePanel && (
            <div className="mt-1 rounded-2xl overflow-hidden shadow-2xl"
                 style={{ background: 'var(--surface)', border: '1px solid var(--border)', maxHeight: 'min(72dvh, 520px)', overflowY: 'auto' }}>
              <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Genres</span>
                <button
                  onClick={() => { setShowGenrePanel(false); setPanelGenre(null) }}
                  className="tap-target w-11 h-11 rounded-full flex items-center justify-center transition-all"
                  style={{ background: 'var(--surface2)', color: 'var(--muted)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface3)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface2)')}
                  aria-label="Fermer les genres"
                  title="Fermer"
                >
                  ×
                </button>
              </div>

              {/* Vue : liste des genres */}
              {!panelGenre && (
                <div className="p-2 space-y-0.5">
                  <p className="text-xs px-3 py-2 font-semibold tracking-widest uppercase" style={{ color: 'var(--muted2)' }}>
                    Genres disponibles
                  </p>
                  {genres.map(g => {
                    const count = artists.filter(a => a.genre === g).length
                    return (
                      <button
                        key={g}
                        onClick={() => setPanelGenre(g)}
                        className="tap-target w-full flex items-center justify-between rounded-xl px-3 py-3 transition-all text-left"
                        style={{ background: 'transparent' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <span className="flex items-center gap-2 text-sm font-medium">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: GENRE_COLORS[g] || 'var(--primary)' }} />
                          <span style={{ color: 'var(--text)' }}>{g}</span>
                        </span>
                        <span className="text-xs rounded-full px-2 py-0.5 font-medium"
                              style={{ background: `${GENRE_COLORS[g] || 'var(--primary)'}22`, color: GENRE_COLORS[g] || 'var(--primary)' }}>
                          {count}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Vue : artistes du genre sélectionné */}
              {panelGenre && (
                <div>
                  <button
                    onClick={() => setPanelGenre(null)}
                    className="tap-target flex items-center gap-2 w-full px-4 py-3 text-sm font-semibold border-b transition-all"
                    style={{ color: 'var(--text)', borderColor: 'var(--border)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ color: 'var(--muted2)' }}>←</span>
                    <span className="w-2 h-2 rounded-full" style={{ background: GENRE_COLORS[panelGenre] || 'var(--primary)' }} />
                    {panelGenre}
                  </button>
                  <div className="p-2 space-y-0.5">
                    {artists.filter(a => a.genre === panelGenre).map(a => (
                      <button
                        key={a.id}
                        onClick={() => flyToArtist(a)}
                        className="tap-target w-full flex items-center gap-3 rounded-xl p-3 transition-all text-left"
                        style={{ background: 'transparent' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        {a.deezer_artist_image ? (
                          <img src={a.deezer_artist_image} alt={a.name}
                               className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-base"
                               style={{ background: 'var(--surface3)', color: 'var(--muted2)' }}>♪</div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{a.name}</div>
                          <div className="text-xs truncate" style={{ color: 'var(--muted2)' }}>
                            📍 {a.country_name}
                          </div>
                        </div>
                        <span className="text-xs flex-shrink-0" style={{ color: 'var(--muted2)' }}>→</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Compteur */}
      <div className="absolute bottom-8 left-3 text-xs z-20 sm:left-4" style={{ color: 'var(--muted2)' }}>
        {artists.length} artiste{artists.length !== 1 ? 's' : ''} sur la carte
      </div>

      {/* ── Réseaux sociaux ──────────────────────────────────────────────── */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-20" style={{ bottom: 'max(32px, env(safe-area-inset-bottom, 32px))' }}>
        <span className="text-xs mr-1 hidden sm:block" style={{ color: 'var(--muted2)', whiteSpace: 'nowrap' }}>Retrouvez-nous</span>
        {[
          {
            label: 'Instagram',
            href: 'https://www.instagram.com/collectifmisssing',
            icon: (
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
              </svg>
            ),
          },
          {
            label: 'TikTok',
            href: 'https://www.tiktok.com/@collectifmisssing',
            icon: (
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
              </svg>
            ),
          },
          {
            label: 'Spotify',
            href: 'https://open.spotify.com/user/315jkboscgwvheujnsuy5jmip3su',
            icon: (
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
              </svg>
            ),
          },
        ].map(({ label, href, icon }) => (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            title={label}
            className="tap-target w-11 h-11 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', color: 'var(--muted)' }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(203,199,236,0.15)'
              e.currentTarget.style.color = 'var(--accent)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
              e.currentTarget.style.color = 'var(--muted)'
            }}
          >
            {icon}
          </a>
        ))}
      </div>

      {/* Engrenage admin */}
      <button
        onClick={() => router.push('/admin')}
        className="tap-target absolute right-3 sm:right-4 w-11 h-11 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all z-20"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', bottom: 'max(32px, env(safe-area-inset-bottom, 32px))' }}
        title="Accès administration"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
             strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--muted2)' }}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {/* ── Modal liste pays ──────────────────────────────────────────────── */}
      {selectedCountry && (
        <div
          className="absolute inset-0 flex items-center justify-center z-[200]"
          style={{ background: 'rgba(8,0,6,0.7)', backdropFilter: 'blur(6px)' }}
          onClick={() => setSelectedCountry(null)}
        >
          <div
            className="rounded-2xl p-4 sm:p-5 max-w-sm w-full mx-3 sm:mx-4 shadow-2xl max-h-[calc(100dvh-6rem)] overflow-y-auto"
            style={{ background: 'var(--surface)', border: '1px solid rgba(212,226,0,0.2)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-bold text-lg" style={{ color: 'var(--text)' }}>{selectedCountry.name}</h3>
                <p className="text-sm" style={{ color: 'var(--muted)' }}>
                  {selectedCountry.artists.length} artiste{selectedCountry.artists.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button onClick={() => setSelectedCountry(null)} className="tap-target w-11 h-11 rounded-full text-xl leading-none transition-opacity hover:opacity-60 flex items-center justify-center" style={{ color: 'var(--muted)', background: 'var(--surface2)' }}>✕</button>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {selectedCountry.artists.map(a => (
                <button
                  key={a.id}
                  onClick={() => { setTooltip(a); setSelectedCountry(null) }}
                  className="tap-target w-full flex items-center gap-3 rounded-xl p-3 transition-all text-left"
                  style={{ background: 'var(--surface2)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface3)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface2)')}
                >
                  {a.deezer_artist_image ? (
                    <img src={a.deezer_artist_image} alt={a.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-lg"
                         style={{ background: 'var(--surface3)', color: 'var(--muted2)' }}>♪</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate" style={{ color: GENRE_COLORS[a.genre] || 'var(--text)' }}>
                      {a.name}
                    </div>
                    <div className="text-xs truncate mt-0.5" style={{ color: 'var(--muted)' }}>♪ {a.song_name}</div>
                    <div className="text-xs" style={{ color: 'var(--muted2)' }}>{a.genre}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Fiche artiste ─────────────────────────────────────────────────── */}
      {tooltip && (
        <div className="absolute inset-0 flex items-center justify-center z-[200]"
             style={{ background: 'rgba(8,0,6,0.6)', backdropFilter: 'blur(4px)' }}
             onClick={() => setTooltip(null)}>
          <div
            className="rounded-2xl p-4 sm:p-5 max-w-sm w-full mx-3 sm:mx-4 shadow-2xl max-h-[calc(100dvh-6rem)] overflow-y-auto"
            style={{
              background:  'var(--surface)',
              border:      `1px solid ${GENRE_COLORS[tooltip.genre] || 'rgba(255,255,255,0.15)'}40`,
              boxShadow:   `0 0 40px ${GENRE_COLORS[tooltip.genre] || '#c8d800'}20`,
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex gap-3 items-start mb-4">
              {tooltip.deezer_artist_image ? (
                <img src={tooltip.deezer_artist_image} alt={tooltip.name}
                     className="w-16 h-16 rounded-xl object-cover flex-shrink-0 shadow-lg" />
              ) : (
                <div className="w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl"
                     style={{ background: 'var(--surface3)' }}>♪</div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-bold text-lg leading-tight truncate" style={{ color: GENRE_COLORS[tooltip.genre] || 'var(--text)' }}>
                  {tooltip.name}
                </div>
                <div className="text-sm mt-1 truncate" style={{ color: 'var(--text)' }}>♪ {tooltip.song_name}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>📍 {tooltip.country_name}</div>
              </div>
              <button onClick={() => setTooltip(null)} className="tap-target w-11 h-11 rounded-full leading-none hover:opacity-60 transition-opacity flex-shrink-0 flex items-center justify-center"
                      style={{ color: 'var(--muted2)', background: 'var(--surface2)' }}>✕</button>
            </div>

            {/* Genre tag */}
            <div className="mb-3">
              <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                    style={{ background: `${GENRE_COLORS[tooltip.genre]}22`, color: GENRE_COLORS[tooltip.genre] || 'var(--text)' }}>
                🎵 {tooltip.genre}
              </span>
            </div>

            <button
              onClick={() => toggleFavorite(tooltip)}
              disabled={favoriteBusy}
              className="tap-target w-full mb-3 rounded-xl px-4 py-3 text-sm font-bold transition-all"
              style={{
                background: favoriteIds.has(tooltip.id) ? 'rgba(200,216,0,0.16)' : 'var(--surface2)',
                color: favoriteIds.has(tooltip.id) ? 'var(--primary)' : 'var(--text)',
                border: '1px solid ' + (favoriteIds.has(tooltip.id) ? 'rgba(200,216,0,0.35)' : 'var(--border)'),
                opacity: favoriteBusy ? 0.6 : 1,
              }}
              type="button"
            >
              {favoriteIds.has(tooltip.id) ? '★ Retirer des favoris' : '☆ Ajouter aux favoris'}
            </button>

            {/* Raison */}
            {tooltip.reason && (
              <div className="mb-3 rounded-xl p-3" style={{ background: 'var(--surface2)', borderLeft: `3px solid ${GENRE_COLORS[tooltip.genre] || 'var(--primary)'}` }}>
                <p className="text-sm italic leading-relaxed" style={{ color: 'var(--muted)' }}>
                  &ldquo;{tooltip.reason}&rdquo;
                </p>
                {tooltip.submitted_by && (
                  <p className="text-xs mt-1.5" style={{ color: 'var(--muted2)' }}>
                    — <span style={{ color: 'var(--muted)' }}>{tooltip.submitted_by}</span>
                  </p>
                )}
              </div>
            )}
            {!tooltip.reason && tooltip.submitted_by && (
              <p className="text-xs mb-3" style={{ color: 'var(--muted2)' }}>
                ✍️ Proposé·e par <span style={{ color: 'var(--muted)' }}>{tooltip.submitted_by}</span>
              </p>
            )}

            {/* Aperçu audio */}
            {tooltip.deezer_preview_url ? (
              <div className="mt-1">
                <p className="text-xs mb-1.5" style={{ color: 'var(--muted2)' }}>🎧 Aperçu (30s)</p>
                <audio controls className="w-full h-10 rounded-lg" src={tooltip.deezer_preview_url} />
              </div>
            ) : (
              <p className="text-xs mt-2 text-center" style={{ color: 'var(--muted2)' }}>
                Aucun aperçu audio disponible pour ce morceau.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}



