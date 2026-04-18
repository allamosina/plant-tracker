-- Migration 007: Add drainage field to plants table
-- Run this in your Supabase SQL editor.

alter table plants add column if not exists has_drainage boolean;
