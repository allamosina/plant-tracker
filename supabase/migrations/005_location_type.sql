-- Migration 005: Add location_type to locations table
-- Run this in your Supabase SQL editor.

alter table locations add column if not exists location_type text;
-- Valid values: indoor_home | greenhouse | outdoor_garden | balcony_patio | office | other
