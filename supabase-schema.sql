-- Créer la table des artistes
create table if not exists artists (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  deezer_artist_id text,
  deezer_artist_image text,
  song_name text not null,
  deezer_track_id text,
  deezer_preview_url text,
  country_code text not null,
  country_name text not null,
  genre text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_at timestamptz default now(),
  reviewed_at timestamptz,
  lat float,
  lng float,
  reason text,
  submitted_by text
);

-- Index pour les recherches fréquentes
create index if not exists artists_status_idx on artists(status);
create index if not exists artists_country_idx on artists(country_code);
create index if not exists artists_genre_idx on artists(genre);

-- Politique RLS : lecture publique des artistes approuvés
alter table artists enable row level security;

create policy "Lecture publique des artistes approuvés"
  on artists for select
  using (status = 'approved');

create policy "Insertion publique pour soumissions"
  on artists for insert
  with check (status = 'pending');

-- Le service role (admin) peut tout faire - géré côté serveur

-- Migration : ajouter les colonnes reason et submitted_by si le projet existe déjà
-- À exécuter dans Supabase SQL Editor si la table artists existe déjà :
-- alter table artists add column if not exists reason text;
-- alter table artists add column if not exists submitted_by text;
