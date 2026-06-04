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
      <Link href="/connexion" className="nav-link text-sm font-medium hidden sm:block">
        Connexion
      </Link>
    )
  }

  return (
    <>
      <Link href="/favoris" className="nav-link text-sm font-medium hidden sm:block">
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
