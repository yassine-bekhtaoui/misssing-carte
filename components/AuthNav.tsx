'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { hasSupabasePublicConfig, supabase } from '@/lib/supabase'

export default function AuthNav() {
  const [user, setUser] = useState<User | null>(null)

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

  const signOut = async () => {
    if (!hasSupabasePublicConfig()) return
    const supabaseClient = supabase()
    await supabaseClient.auth.signOut()
  }

  if (!user) {
    return (
      <Link
        href="/connexion"
        className="tap-target text-sm font-semibold px-3 py-2 rounded-full transition-all whitespace-nowrap flex items-center justify-center"
        style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)' }}
      >
        Compte
      </Link>
    )
  }

  return (
    <>
      <Link
        href="/favoris"
        className="tap-target text-sm font-semibold px-3 py-2 rounded-full transition-all whitespace-nowrap flex items-center justify-center"
        style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)' }}
      >
        Favoris
      </Link>
      <button
        onClick={signOut}
        className="nav-link text-sm font-medium hidden md:block"
        type="button"
      >
        Déconnexion
      </button>
    </>
  )
}
