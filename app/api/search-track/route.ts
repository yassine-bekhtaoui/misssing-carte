import { NextRequest, NextResponse } from 'next/server'

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export async function GET(req: NextRequest) {
  const artistId = req.nextUrl.searchParams.get('artistId')
  const query = req.nextUrl.searchParams.get('q') || ''

  if (!artistId) return NextResponse.json({ data: [] })

  try {
    const res = await fetch(
      `https://api.deezer.com/artist/${artistId}/top?limit=50`,
      { next: { revalidate: 60 } }
    )
    const data = await res.json()

    if (!query.trim()) return NextResponse.json(data)

    const normalizedQuery = normalize(query)
    const filtered = (data.data || []).filter((track: { title: string }) =>
      normalize(track.title).includes(normalizedQuery)
    )
    return NextResponse.json({ data: filtered })
  } catch {
    return NextResponse.json({ error: 'Erreur de recherche' }, { status: 500 })
  }
}
