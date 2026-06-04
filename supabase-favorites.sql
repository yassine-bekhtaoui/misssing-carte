-- Activer les favoris utilisateurs
create table if not exists favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  artist_id uuid not null references artists(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, artist_id)
);

create index if not exists favorites_user_idx on favorites(user_id);
create index if not exists favorites_artist_idx on favorites(artist_id);

alter table favorites enable row level security;

create policy "Lecture de ses propres favoris"
  on favorites for select
  using (auth.uid() = user_id);

create policy "Ajout de ses propres favoris"
  on favorites for insert
  with check (auth.uid() = user_id);

create policy "Suppression de ses propres favoris"
  on favorites for delete
  using (auth.uid() = user_id);
