import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { COUNTRIES } from '@/lib/countries'

type ArtistRow = {
  deezer_track_id?: string | null
  deezer_preview_url?: string | null
  [key: string]: unknown
}

async function refreshPreviewUrl(artist: ArtistRow) {
  if (!artist.deezer_track_id) return artist

  try {
    const res = await fetch(`https://api.deezer.com/track/${artist.deezer_track_id}`, {
      cache: 'no-store',
    })
    if (!res.ok) return artist

    const track = await res.json()
    if (typeof track.preview !== 'string' || !track.preview) return artist

    return {
      ...artist,
      deezer_preview_url: track.preview,
    }
  } catch {
    return artist
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { artistName, deezerArtistId, deezerArtistImage, songName, deezerTrackId, deezerPreviewUrl, countryCode, origins, genre, reason, submittedBy } = body

    if (!artistName || !songName || !countryCode || !genre) {
      return NextResponse.json({ error: 'Champs manquants' }, { status: 400 })
    }

    const country = COUNTRIES.find(c => c.code === countryCode)
    if (!country) {
      return NextResponse.json({ error: 'Pays invalide' }, { status: 400 })
    }

    const baseData = {
      name: artistName,
      deezer_artist_id: deezerArtistId || null,
      deezer_artist_image: deezerArtistImage || null,
      song_name: songName,
      deezer_track_id: deezerTrackId || null,
      deezer_preview_url: deezerPreviewUrl || null,
      country_code: countryCode,
      country_name: country.name,
      genre,
      status: 'pending',
      lat: country.lat,
      lng: country.lng,
    }

    let { error } = await supabaseAdmin().from('artists').insert({
      ...baseData,
      origins: origins || null,
      reason: reason || null,
      submitted_by: submittedBy || null,
    })

    // Si la colonne origins n'existe pas encore, on garde les autres champs optionnels.
    if (error && (error.code === '42703' || error.message?.includes('column'))) {
      const result = await supabaseAdmin().from('artists').insert({
        ...baseData,
        reason: reason || null,
        submitted_by: submittedBy || null,
      })
      error = result.error
    }

    // Si les colonnes reason/submitted_by n'existent pas encore, on reessaie sans.
    if (error && (error.code === '42703' || error.message?.includes('column'))) {
      const result = await supabaseAdmin().from('artists').insert(baseData)
      error = result.error
    }

    if (error) {
      console.error(error)
      return NextResponse.json({ error: 'Erreur lors de la soumission. Veuillez réessayer.' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erreur serveur inattendue.' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin()
      .from('artists')
      .select('*')
      .eq('status', 'approved')
      .order('submitted_at', { ascending: false })

    if (error) return NextResponse.json([])

    const artistsWithFreshPreviews = await Promise.all(
      (data || []).map(refreshPreviewUrl)
    )

    return NextResponse.json(artistsWithFreshPreviews)
  } catch {
    return NextResponse.json([])
  }
}
