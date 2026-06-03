'use client'

import { useState, useEffect, useCallback } from 'react'
import { GENRE_COLORS } from '@/lib/genres'

interface Artist {
  id: string
  name: string
  song_name: string
  country_name: string
  genre: string
  deezer_artist_image?: string
  deezer_preview_url?: string
  reason?: string
  submitted_by?: string
  submitted_at: string
  status: string
}

export default function AdminPanel() {
  const [loggedIn,      setLoggedIn]      = useState(false)
  const [password,      setPassword]      = useState('')
  const [loginError,    setLoginError]    = useState('')
  const [loginLoading,  setLoginLoading]  = useState(false)

  const [pending,        setPending]        = useState<Artist[]>([])
  const [loadingPending, setLoadingPending] = useState(false)
  const [actionLoading,  setActionLoading]  = useState<string | null>(null)

  const [tab,      setTab]      = useState<'pending' | 'approved'>('pending')
  const [approved, setApproved] = useState<Artist[]>([])

  const loadPending = useCallback(async () => {
    setLoadingPending(true)
    const res = await fetch('/api/admin/pending')
    if (res.status === 401) { setLoggedIn(false); return }
    const data = await res.json()
    setPending(Array.isArray(data) ? data : [])
    setLoadingPending(false)
  }, [])

  const loadApproved = useCallback(async () => {
    const res  = await fetch('/api/submit')
    const data = await res.json()
    setApproved(Array.isArray(data) ? data : [])
  }, [])

  useEffect(() => {
    if (loggedIn) { loadPending(); loadApproved() }
  }, [loggedIn, loadPending, loadApproved])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError('')
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    setLoginLoading(false)
    if (res.ok) { setLoggedIn(true) } else { setLoginError('Mot de passe incorrect.') }
  }

  const handleLogout = async () => {
    await fetch('/api/admin/login', { method: 'DELETE' })
    setLoggedIn(false)
    setPassword('')
  }

  const handleReview = async (id: string, action: 'approve' | 'reject') => {
    setActionLoading(id + action)
    await fetch(`/api/admin/review/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    setActionLoading(null)
    loadPending()
    loadApproved()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer définitivement cet artiste ?')) return
    setActionLoading(id + 'delete')
    await fetch(`/api/admin/review/${id}`, { method: 'DELETE' })
    setActionLoading(null)
    loadApproved()
  }

  const inputStyle = {
    background:  'var(--surface2)',
    color:       'var(--text)',
    border:      '1px solid rgba(255,255,255,0.10)',
  }

  // ── Login ─────────────────────────────────────────────────────────────────
  if (!loggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
        <form onSubmit={handleLogin} className="rounded-2xl p-8 w-full max-w-sm shadow-2xl"
              style={{ background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">🎛️</div>
            <h1 className="text-2xl font-bold text-white">Panel admin</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>Accès réservé à l&apos;équipe</p>
          </div>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Mot de passe…"
            className="w-full rounded-xl px-4 py-3 outline-none transition-colors mb-3 text-sm"
            style={inputStyle}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--primary)')}
            onBlur={e  => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)')}
          />
          {loginError && <p className="text-sm mb-3 text-center" style={{ color: '#f87171' }}>{loginError}</p>}
          <button
            type="submit"
            disabled={loginLoading || !password}
            className="w-full font-bold py-3 rounded-xl transition-all"
            style={{
              background: password && !loginLoading ? 'var(--primary)' : 'var(--surface2)',
              color:      password && !loginLoading ? 'var(--on-primary)' : 'var(--muted2)',
            }}
          >
            {loginLoading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
      </div>
    )
  }

  // ── Panel ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen p-4" style={{ background: 'var(--bg)' }}>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Panel admin</h1>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              {pending.length} soumission{pending.length !== 1 ? 's' : ''} en attente
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm rounded-xl px-3 py-2 transition-all"
            style={{ color: 'var(--muted)', border: '1px solid rgba(255,255,255,0.10)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
          >
            Déconnexion
          </button>
        </div>

        {/* Onglets */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setTab('pending')}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={{
              background: tab === 'pending' ? 'var(--primary)' : 'var(--surface2)',
              color:      tab === 'pending' ? 'var(--on-primary)' : 'var(--muted)',
            }}
          >
            En attente{pending.length > 0 && (
              <span className="ml-1.5 rounded-full px-1.5 py-0.5 text-xs font-bold"
                    style={{ background: 'rgba(255,255,255,0.2)' }}>{pending.length}</span>
            )}
          </button>
          <button
            onClick={() => setTab('approved')}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={{
              background: tab === 'approved' ? '#2a7a4a' : 'var(--surface2)',
              color:      tab === 'approved' ? '#fff'    : 'var(--muted)',
            }}
          >
            Approuvés ({approved.length})
          </button>
        </div>

        {tab === 'pending' && (
          <div>
            {loadingPending && <p className="text-center py-8" style={{ color: 'var(--muted)' }}>Chargement…</p>}
            {!loadingPending && pending.length === 0 && (
              <div className="text-center py-12">
                <div className="text-4xl mb-2">✨</div>
                <p style={{ color: 'var(--muted)' }}>Aucune soumission en attente.</p>
              </div>
            )}
            <div className="space-y-4">
              {pending.map(a => (
                <ArtistCard key={a.id} artist={a} mode="pending" actionLoading={actionLoading}
                  onApprove={() => handleReview(a.id, 'approve')}
                  onReject={()  => handleReview(a.id, 'reject')} />
              ))}
            </div>
          </div>
        )}

        {tab === 'approved' && (
          <div className="space-y-4">
            {approved.length === 0 && (
              <div className="text-center py-12">
                <p style={{ color: 'var(--muted)' }}>Aucun artiste approuvé.</p>
              </div>
            )}
            {approved.map(a => (
              <ArtistCard key={a.id} artist={a} mode="approved" actionLoading={actionLoading}
                onDelete={() => handleDelete(a.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ArtistCard({ artist, mode, actionLoading, onApprove, onReject, onDelete }: {
  artist: Artist
  mode: 'pending' | 'approved'
  actionLoading: string | null
  onApprove?: () => void
  onReject?: () => void
  onDelete?: () => void
}) {
  const color    = GENRE_COLORS[artist.genre] || 'var(--primary)'
  const isLoading = actionLoading?.startsWith(artist.id)
  const date     = new Date(artist.submitted_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="rounded-2xl p-4" style={{
      background:      'var(--surface)',
      border:          '1px solid rgba(255,255,255,0.06)',
      borderLeftColor: color,
      borderLeftWidth: 3,
    }}>
      <div className="flex items-start gap-3">
        {artist.deezer_artist_image && (
          <img src={artist.deezer_artist_image} alt={artist.name} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="font-bold text-white text-lg leading-tight">{artist.name}</div>
          <div className="text-sm" style={{ color: 'var(--muted)' }}>♪ {artist.song_name}</div>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${color}22`, color }}>
              {artist.genre}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--surface2)', color: 'var(--muted)' }}>
              📍 {artist.country_name}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--surface2)', color: 'var(--muted2)' }}>
              {date}
            </span>
          </div>
          {artist.reason && (
            <p className="text-xs mt-2 italic" style={{ color: 'var(--muted)' }}>💬 &ldquo;{artist.reason}&rdquo;</p>
          )}
          {artist.submitted_by && (
            <p className="text-xs mt-1" style={{ color: 'var(--muted2)' }}>
              ✍️ Ajouté·e par <span style={{ color: 'var(--muted)' }}>{artist.submitted_by}</span>
            </p>
          )}
          {artist.deezer_preview_url && (
            <audio controls className="w-full mt-2 h-8" src={artist.deezer_preview_url} />
          )}
        </div>
      </div>

      {mode === 'pending' && (
        <div className="flex gap-3 mt-4">
          <button
            disabled={!!isLoading} onClick={onReject}
            className="flex-1 font-medium py-2 rounded-xl transition-all"
            style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', opacity: isLoading ? 0.5 : 1 }}
          >
            {actionLoading === artist.id + 'reject' ? '…' : '✕ Refuser'}
          </button>
          <button
            disabled={!!isLoading} onClick={onApprove}
            className="flex-1 font-bold py-2 rounded-xl transition-all"
            style={{ background: 'rgba(42,122,74,0.2)', border: '1px solid rgba(42,122,74,0.4)', color: '#4ade80', opacity: isLoading ? 0.5 : 1 }}
          >
            {actionLoading === artist.id + 'approve' ? '…' : '✓ Valider'}
          </button>
        </div>
      )}

      {mode === 'approved' && (
        <button
          disabled={!!isLoading} onClick={onDelete}
          className="mt-3 w-full text-xs transition-colors"
          style={{ color: 'var(--muted2)', opacity: isLoading ? 0.5 : 1 }}
          onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted2)')}
        >
          {actionLoading === artist.id + 'delete' ? 'Suppression…' : 'Supprimer'}
        </button>
      )}
    </div>
  )
}
