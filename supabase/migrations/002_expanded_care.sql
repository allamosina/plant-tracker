-- Migration 002: Expanded care tracking
-- Run this in your Supabase SQL editor.

-- Misting care
alter table plants add column if not exists last_misted_at date;
alter table plants add column if not exists next_misted_at date;
alter table plants add column if not exists misting_interval_days integer;
alter table plants add column if not exists misting_source text;

-- Fertilizing intelligence (dates already exist — adding computed interval)
alter table plants add column if not exists fertilizing_interval_days integer;
alter table plants add column if not exists fertilizing_source text;

-- Care profile (populated by species lookup)
alter table plants add column if not exists light_requirement text;   -- low | medium | bright_indirect | direct
alter table plants add column if not exists humidity_preference text; -- low | medium | high
alter table plants add column if not exists temperature_min integer;  -- Celsius
alter table plants add column if not exists temperature_max integer;
alter table plants add column if not exists soil_type text;

-- Pot info
alter table plants add column if not exists pot_type text;          -- plastic | terracotta | stoneware | glass | other
alter table plants add column if not exists pot_diameter_cm integer;
alter table plants add column if not exists pot_height_cm integer;

-- Add misting as a loggable action
alter type log_type add value if not exists 'misting';
