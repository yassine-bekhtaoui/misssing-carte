import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { COUNTRIES } from '@/lib/countries'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { artistName, deezerArtistId, deezerArtistImage, songName, deezerTrackId, deezerPreviewUrl, countryCode, genre, reason, submittedBy } = body

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
      reason: reason || null,
      submitted_by: submittedBy || null,
    })

    // Si les colonnes reason/submitted_by n'existent pas encore, on réessaie sans
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
    return NextResponse.json(data)
  } catch {
    return NextResponse.json([])
  }
}
