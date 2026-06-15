'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { GENRES } from '@/lib/genres'
import { COUNTRIES } from '@/lib/countries'

interface DeezerArtist {
  id: number
  name: string
  picture_medium: string
  nb_fan: number
}

interface DeezerTrack {
  id: number
  title: string
  preview: string
  duration: number
  album: {
    cover_medium: string
    title: string
  }
}

export default function ArtistForm() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3>(1)

  const [artistQuery,   setArtistQuery]   = useState('')
  const [artistResults, setArtistResults] = useState<DeezerArtist[]>([])
  const [selectedArtist,setSelectedArtist]= useState<DeezerArtist | null>(null)
  const [artistLoading, setArtistLoading] = useState(false)

  const [trackQuery,   setTrackQuery]   = useState('')
  const [trackResults, setTrackResults] = useState<DeezerTrack[]>([])
  const [selectedTrack,setSelectedTrack]= useState<DeezerTrack | null>(null)
  const [trackLoading, setTrackLoading] = useState(false)

  const [country,     setCountry]     = useState('')
  const [origins,     setOrigins]     = useState('')
  const [genre,       setGenre]       = useState('')
  const [reason,      setReason]      = useState('')
  const [submittedBy, setSubmittedBy] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [submitted,  setSubmitted]  = useState(false)
  const [error,      setError]      = useState('')

  const artistTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const trackTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (artistQuery.length < 2) { setArtistResults([]); return }
    if (artistTimer.current) clearTimeout(artistTimer.current)
    artistTimer.current = setTimeout(async () => {
      setArtistLoading(true)
      const res  = await fetch(`/api/search-artist?q=${encodeURIComponent(artistQuery)}`)
      const data = await res.json()
      setArtistResults(data.data || [])
      setArtistLoading(false)
    }, 400)
  }, [artistQuery])

  useEffect(() => {
    if (!selectedArtist) return
    if (trackTimer.current) clearTimeout(trackTimer.current)
    setTrackLoading(true)
    trackTimer.current = setTimeout(async () => {
      const q   = trackQuery ? `&q=${encodeURIComponent(trackQuery)}` : ''
      const res  = await fetch(`/api/search-track?artistId=${selectedArtist.id}${q}`)
      const data = await res.json()
      setTrackResults(data.data || [])
      setTrackLoading(false)
    }, 400)
  }, [selectedArtist, trackQuery])

  const handleSubmit = async () => {
    if (!selectedArtist || !selectedTrack || !country || !genre) {
      setError('Veuillez remplir tous les champs.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistName:       selectedArtist.name,
          deezerArtistId:   String(selectedArtist.id),
          deezerArtistImage:selectedArtist.picture_medium,
          songName:         selectedTrack.title,
          deezerTrackId:    String(selectedTrack.id),
          deezerPreviewUrl: selectedTrack.preview,
          countryCode:      country,
          origins:          origins.trim() || undefined,
          genre,
          reason:           reason.trim()      || undefined,
          submittedBy:      submittedBy.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setSubmitted(true)
      } else {
        setError(data.error || 'Une erreur est survenue.')
      }
    } catch {
      setError('Impossible de contacter le serveur. Vérifiez votre connexion.')
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setSubmitted(false); setStep(1)
    setArtistQuery(''); setSelectedArtist(null)
    setTrackQuery('');  setSelectedTrack(null)
    setCountry('');     setGenre('')
    setOrigins('')
    setReason('');      setSubmittedBy('')
  }

  // ── Succès ────────────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
        <div className="rounded-2xl p-8 max-w-md w-full text-center shadow-2xl"
             style={{ background: 'var(--surface)', border: '1px solid rgba(181,22,95,0.3)' }}>
          <div className="text-5xl mb-4">🎵</div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--primary)' }}>Soumission envoyée !</h2>
          <p className="mb-1" style={{ color: 'var(--text)' }}>
            <span className="font-semibold">{selectedArtist?.name}</span> — {selectedTrack?.title}
          </p>
          <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
            Votre proposition sera visible sur le globe après validation par notre équipe.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => router.push('/')}
              className="tap-target font-bold px-6 py-3 rounded-xl transition-all"
              style={{ background: 'var(--primary)', color: 'var(--on-primary)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--primary-hv)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--primary)')}
            >
              Retour au globe
            </button>
            <button
              onClick={resetForm}
              className="tap-target font-bold px-6 py-3 rounded-xl transition-all"
              style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface3)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface2)')}
            >
              Ajouter un·e autre artiste
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── styles partagés ───────────────────────────────────────────────────────
  const inputCls = "w-full text-sm placeholder-opacity-50 rounded-xl px-4 py-3 outline-none transition-colors"
  const inputStyle = {
    background:  'var(--surface2)',
    color:       'var(--text)',
    border:      '1px solid rgba(255,255,255,0.10)',
  }
  const inputFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = 'var(--primary)'
  }
  const inputBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'
  }

  return (
    <div className="min-h-screen p-3 sm:p-4 flex items-start justify-center" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-lg mt-5 sm:mt-8">
        <h1 className="text-2xl font-bold text-white mb-2 text-center">Proposer un·e artiste</h1>
        <p className="text-sm text-center mb-8" style={{ color: 'var(--muted)' }}>
          Votre suggestion sera validée par notre équipe avant d&apos;apparaître sur le globe.
        </p>

        {/* Indicateur d'étapes */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map(n => (
            <div key={n} className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors"
                   style={{
                     background: step > n ? '#2a7a4a' : step === n ? 'var(--primary)' : 'var(--surface2)',
                     color:      step > n ? '#fff'    : step === n ? 'var(--on-primary)' : 'var(--muted2)',
                   }}>
                {step > n ? '✓' : n}
              </div>
              {n < 3 && <div className="w-8 h-0.5" style={{ background: step > n ? '#2a7a4a' : 'var(--surface3)' }} />}
            </div>
          ))}
        </div>

        {/* ── Étape 1 : Artiste ─────────────────────────────────────────── */}
        {step === 1 && (
          <div className="rounded-2xl p-4 sm:p-6" style={{ background: 'var(--surface)' }}>
            <h2 className="text-lg font-semibold text-white mb-4">1. Rechercher l&apos;artiste</h2>
            <input
              type="text"
              value={artistQuery}
              onChange={e => { setArtistQuery(e.target.value); setSelectedArtist(null) }}
              placeholder="Nom de l'artiste…"
              className={inputCls}
              style={inputStyle}
              onFocus={inputFocus}
              onBlur={inputBlur}
            />
            {artistLoading && <p className="text-sm mt-2 text-center" style={{ color: 'var(--muted)' }}>Recherche en cours…</p>}
            {artistResults.length > 0 && !selectedArtist && (
              <div className="mt-3 space-y-2 max-h-72 overflow-y-auto">
                {artistResults.map(a => (
                  <button
                    key={a.id}
                    onClick={() => { setSelectedArtist(a); setArtistQuery(a.name); setArtistResults([]) }}
                    className="tap-target w-full flex items-center gap-3 rounded-xl p-3 transition-all text-left"
                    style={{ background: 'var(--surface2)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface3)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface2)')}
                  >
                    {a.picture_medium && (
                      <img src={a.picture_medium} alt={a.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                    )}
                    <div>
                      <div className="text-white font-medium">{a.name}</div>
                      <div className="text-xs" style={{ color: 'var(--muted2)' }}>{a.nb_fan?.toLocaleString('fr-FR')} fans</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {selectedArtist && (
              <div className="mt-3 flex items-center gap-3 rounded-xl p-3"
                   style={{ background: 'rgba(181,22,95,0.1)', border: '1px solid rgba(181,22,95,0.3)' }}>
                {selectedArtist.picture_medium && (
                  <img src={selectedArtist.picture_medium} alt={selectedArtist.name} className="w-12 h-12 rounded-lg object-cover" />
                )}
                <div className="flex-1">
                  <div className="font-bold" style={{ color: 'var(--primary-hv)' }}>{selectedArtist.name}</div>
                  <div className="text-xs" style={{ color: 'var(--muted2)' }}>Artiste sélectionné·e</div>
                </div>
                <button onClick={() => { setSelectedArtist(null); setArtistQuery('') }}
                        className="tap-target w-11 h-11 rounded-full hover:opacity-60 transition-opacity flex items-center justify-center" style={{ color: 'var(--muted2)', background: 'var(--surface2)' }}>✕</button>
              </div>
            )}
            <button
              disabled={!selectedArtist}
              onClick={() => setStep(2)}
              className="tap-target mt-4 w-full font-bold py-3 rounded-xl transition-all"
              style={{
                background: selectedArtist ? 'var(--primary)' : 'var(--surface2)',
                color: selectedArtist ? 'var(--on-primary)'           : 'var(--muted2)',
              }}
            >
              Suivant →
            </button>
          </div>
        )}

        {/* ── Étape 2 : Morceau ─────────────────────────────────────────── */}
        {step === 2 && (
          <div className="rounded-2xl p-4 sm:p-6" style={{ background: 'var(--surface)' }}>
            <h2 className="text-lg font-semibold text-white mb-1">2. Choisir un morceau</h2>
            <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
              de <span className="font-medium" style={{ color: 'var(--primary-hv)' }}>{selectedArtist?.name}</span>
            </p>
            <input
              type="text"
              value={trackQuery}
              onChange={e => { setTrackQuery(e.target.value); setSelectedTrack(null) }}
              placeholder="Nom du morceau (optionnel)…"
              className={inputCls}
              style={inputStyle}
              onFocus={inputFocus}
              onBlur={inputBlur}
            />
            {trackLoading && <p className="text-sm mt-2 text-center" style={{ color: 'var(--muted)' }}>Chargement…</p>}
            {trackResults.length > 0 && !selectedTrack && (
              <div className="mt-3 space-y-2 max-h-72 overflow-y-auto">
                {trackResults.map(t => (
                  <button
                    key={t.id}
                    onClick={() => { setSelectedTrack(t); setTrackResults([]) }}
                    className="tap-target w-full flex items-center gap-3 rounded-xl p-3 transition-all text-left"
                    style={{ background: 'var(--surface2)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface3)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface2)')}
                  >
                    {t.album?.cover_medium ? (
                      <img src={t.album.cover_medium} alt={t.album.title} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                           style={{ background: 'var(--surface3)', color: 'var(--muted2)' }}>♪</div>
                    )}
                    <div>
                      <div className="text-white font-medium">{t.title}</div>
                      <div className="text-xs" style={{ color: 'var(--muted2)' }}>
                        {t.album?.title} · {Math.floor(t.duration / 60)}:{String(t.duration % 60).padStart(2, '0')}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {selectedTrack && (
              <div className="mt-3 flex items-center gap-3 rounded-xl p-3"
                   style={{ background: 'rgba(181,22,95,0.1)', border: '1px solid rgba(181,22,95,0.3)' }}>
                {selectedTrack.album?.cover_medium ? (
                  <img src={selectedTrack.album.cover_medium} alt={selectedTrack.album.title}
                       className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                       style={{ background: 'rgba(181,22,95,0.2)', color: 'var(--primary-hv)' }}>♪</div>
                )}
                <div className="flex-1">
                  <div className="font-bold" style={{ color: 'var(--primary-hv)' }}>{selectedTrack.title}</div>
                  <div className="text-xs" style={{ color: 'var(--muted2)' }}>{selectedTrack.album?.title}</div>
                </div>
                <button onClick={() => setSelectedTrack(null)} className="tap-target w-11 h-11 rounded-full hover:opacity-60 flex items-center justify-center" style={{ color: 'var(--muted2)', background: 'var(--surface2)' }}>✕</button>
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              <button onClick={() => setStep(1)}
                      className="tap-target flex-1 font-bold py-3 rounded-xl transition-all"
                      style={{ background: 'var(--surface2)', color: 'var(--muted)' }}>
                ← Retour
              </button>
              <button
                disabled={!selectedTrack}
                onClick={() => setStep(3)}
                className="tap-target flex-1 font-bold py-3 rounded-xl transition-all"
                style={{
                  background: selectedTrack ? 'var(--primary)' : 'var(--surface2)',
                  color: selectedTrack ? 'var(--on-primary)'           : 'var(--muted2)',
                }}
              >
                Suivant →
              </button>
            </div>
          </div>
        )}

        {/* ── Étape 3 : Pays + Genre + Contexte ─────────────────────────── */}
        {step === 3 && (
          <div className="rounded-2xl p-4 sm:p-6" style={{ background: 'var(--surface)' }}>
            <h2 className="text-lg font-semibold text-white mb-4">3. Pays d&apos;origine et genre</h2>

            <label className="block text-sm mb-2" style={{ color: 'var(--muted)' }}>Pays d&apos;origine</label>
            <select
              value={country}
              onChange={e => setCountry(e.target.value)}
              className={`${inputCls} mb-4`}
              style={inputStyle}
              onFocus={inputFocus}
              onBlur={inputBlur}
            >
              <option value="">Sélectionner un pays…</option>
              {COUNTRIES.sort((a, b) => a.name.localeCompare(b.name)).map(c => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>

            <label className="block text-sm mb-2" style={{ color: 'var(--muted)' }}>
              Origines <span style={{ color: 'var(--muted2)' }}>(facultatif)</span>
            </label>
            <input
              type="text"
              value={origins}
              onChange={e => setOrigins(e.target.value)}
              placeholder="Ex. Maroc / France, Guadeloupe..."
              className={`${inputCls} mb-4`}
              style={inputStyle}
              onFocus={inputFocus}
              onBlur={inputBlur}
            />

            <label className="block text-sm mb-2" style={{ color: 'var(--muted)' }}>Genre musical</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
              {GENRES.map(g => (
                <button
                  key={g}
                  onClick={() => setGenre(g)}
                  className="tap-target py-3 px-3 rounded-xl text-sm font-medium border transition-all text-left"
                  style={{
                    background:  genre === g ? 'var(--primary)' : 'var(--surface2)',
                    borderColor: genre === g ? 'var(--primary)' : 'rgba(255,255,255,0.08)',
                    color:       genre === g ? 'var(--on-primary)' : 'var(--muted)',
                  }}
                >
                  {g}
                </button>
              ))}
            </div>

            <label className="block text-sm mb-2" style={{ color: 'var(--muted)' }}>
              Pourquoi recommandes-tu cet·te artiste ? <span style={{ color: 'var(--muted2)' }}>(facultatif)</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Ce qui rend cet·te artiste unique, un coup de cœur…"
              rows={3}
              className="w-full text-sm rounded-xl px-4 py-3 outline-none transition-colors resize-none mb-4"
              style={{ ...inputStyle }}
              onFocus={inputFocus}
              onBlur={inputBlur}
            />

            <label className="block text-sm mb-2" style={{ color: 'var(--muted)' }}>
              Ajouté·e par <span style={{ color: 'var(--muted2)' }}>(facultatif)</span>
            </label>
            <input
              type="text"
              value={submittedBy}
              onChange={e => setSubmittedBy(e.target.value)}
              placeholder="Ton prénom ou pseudo…"
              className={`${inputCls} mb-5`}
              style={inputStyle}
              onFocus={inputFocus}
              onBlur={inputBlur}
            />

            {error && <p className="text-sm mb-4 text-center" style={{ color: '#f87171' }}>{error}</p>}

            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={() => setStep(2)}
                      className="tap-target flex-1 font-bold py-3 rounded-xl transition-all"
                      style={{ background: 'var(--surface2)', color: 'var(--muted)' }}>
                ← Retour
              </button>
              <button
                disabled={!country || !genre || submitting}
                onClick={handleSubmit}
                className="tap-target flex-1 font-bold py-3 rounded-xl transition-all"
                style={{
                  background: country && genre && !submitting ? 'var(--primary)' : 'var(--surface2)',
                  color: country && genre && !submitting ? 'var(--on-primary)'           : 'var(--muted2)',
                }}
              >
                {submitting ? 'Envoi…' : 'Soumettre ✓'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
