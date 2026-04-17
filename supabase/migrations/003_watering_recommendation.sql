-- Migration 003: Watering recommendation cache
-- Run this in your Supabase SQL editor.

alter table plants add column if not exists watering_recommendation text;
alter table plants add column if not exists watering_recommendation_updated_at timestamptz;
