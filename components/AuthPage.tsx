'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { hasSupabasePublicConfig, supabase } from '@/lib/supabase'

export default function AuthPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    setError('')

    if (!hasSupabasePublicConfig()) {
      setError('Connexion indisponible: ajoutez NEXT_PUBLIC_SUPABASE_ANON_KEY dans les variables d’environnement.')
      setLoading(false)
      return
    }

    const supabaseClient = supabase()
    const credentials = { email: email.trim(), password }
    const result = mode === 'signup'
      ? await supabaseClient.auth.signUp(credentials)
      : await supabaseClient.auth.signInWithPassword(credentials)

    setLoading(false)

    if (result.error) {
      setError(result.error.message)
      return
    }

    if (mode === 'signup' && !result.data.session) {
      setMessage('Compte créé. Vérifiez vos emails pour confirmer votre inscription.')
      return
    }

    router.push('/favoris')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text)' }}>
          {mode === 'login' ? 'Connexion' : 'Créer un compte'}
        </h1>
        <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
          Connectez-vous pour sauvegarder vos artistes favoris et les retrouver partout.
        </p>

        <label className="block text-sm mb-2" style={{ color: 'var(--muted)' }}>Email</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="w-full text-sm rounded-xl px-4 py-3 outline-none mb-4"
          style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)' }}
        />

        <label className="block text-sm mb-2" style={{ color: 'var(--muted)' }}>Mot de passe</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          minLength={6}
          className="w-full text-sm rounded-xl px-4 py-3 outline-none mb-4"
          style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)' }}
        />

        {error && <p className="text-sm mb-4" style={{ color: '#f87171' }}>{error}</p>}
        {message && <p className="text-sm mb-4" style={{ color: 'var(--primary)' }}>{message}</p>}

        <button
          disabled={loading}
          className="w-full font-bold py-3 rounded-xl transition-all"
          style={{ background: 'var(--primary)', color: 'var(--on-primary)', opacity: loading ? 0.6 : 1 }}
          type="submit"
        >
          {loading ? 'Chargement...' : mode === 'login' ? 'Se connecter' : "S'inscrire"}
        </button>

        <button
          type="button"
          onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setMessage('') }}
          className="w-full text-sm mt-4"
          style={{ color: 'var(--muted)' }}
        >
          {mode === 'login' ? 'Créer un compte' : 'J’ai déjà un compte'}
        </button>
      </form>
    </div>
  )
}
