'use client'

import dynamic from 'next/dynamic'

const Globe = dynamic(() => import('./Globe'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-black flex items-center justify-center">
      <div className="text-white text-xl animate-pulse">Chargement du globe...</div>
    </div>
  ),
})

export default function GlobeWrapper() {
  return <Globe />
}
