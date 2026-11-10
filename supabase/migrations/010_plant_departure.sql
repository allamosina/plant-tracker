-- 010: Plant Heaven & Rehomed
-- Records why a plant left the collection. `archived_at` stays the departure date.
--   passed_away → Plant Heaven
--   given_away  → Rehomed
--   left_behind → Rehomed (stayed at an old home)
-- Archived plants with a NULL reason show up as "Unsorted" on the Rehomed page.

do $$ begin
  create type departure_reason as enum ('passed_away', 'given_away', 'left_behind');
exception
  when duplicate_object then null;
end $$;

alter table plants
  add column if not exists departure_reason departure_reason,
  add column if not exists departure_note   text,  -- optional words: what happened / who has it now
  add column if not exists departure_place  text;  -- snapshot of where it stayed (survives site deletion)

create index if not exists plants_departed_idx
  on plants(user_id, departure_reason)
  where archived_at is not null;
