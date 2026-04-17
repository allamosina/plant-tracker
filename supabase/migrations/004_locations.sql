-- Migration 004: Site locations table
-- Run this in your Supabase SQL editor.

create table if not exists locations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users on delete cascade not null,
  name        text not null,
  light_level text,          -- low | medium | bright_indirect | direct
  humidity    text,          -- low | medium | high
  notes       text,
  photo_urls  text[] not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table locations enable row level security;

-- One entry per (user, location name)
create unique index if not exists locations_user_name_idx on locations (user_id, name);

create policy "Users can manage own locations"
  on locations for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
