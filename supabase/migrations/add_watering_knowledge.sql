-- Migration: add watering knowledge columns to plants table
-- Run this in your Supabase SQL editor if you already have the schema applied.

alter table plants
  add column if not exists watering_interval_days integer,
  add column if not exists watering_source text;
