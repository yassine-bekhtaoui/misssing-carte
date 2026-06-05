'use client'

import { useEffect } from 'react'

export default function PwaRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.register('/sw.js').catch(() => {
      // PWA support should never block the app.
    })
  }, [])

  return null
}
