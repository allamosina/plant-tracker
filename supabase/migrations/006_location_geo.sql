-- Migration 006: Add geographic fields to locations table
-- Run this in your Supabase SQL editor.

alter table locations add column if not exists geo_city    text;
alter table locations add column if not exists geo_country text;
alter table locations add column if not exists geo_lat     float8;
alter table locations add column if not exists geo_lng     float8;

-- Useful index for future weather-based queries (e.g. finding all locations near a point)
create index if not exists locations_geo_idx on locations (user_id, geo_lat, geo_lng)
  where geo_lat is not null and geo_lng is not null;
