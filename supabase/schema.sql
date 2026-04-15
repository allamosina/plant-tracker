-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Enums
create type plant_status as enum ('healthy', 'needs_attention', 'recovering');
create type log_type as enum ('watering', 'fertilizing', 'repotting', 'pruning', 'issue_observed');

-- Plants table
create table plants (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  nickname text,
  species text,
  location text,
  acquisition_date date,
  notes text,
  status plant_status not null default 'healthy',
  photo_url text,
  last_watered_at date,
  next_watered_at date,
  last_fertilized_at date,
  next_fertilized_at date,
  last_repotted_at date,
  watering_interval_days integer,
  watering_source text,
  last_misted_at date,
  next_misted_at date,
  misting_interval_days integer,
  misting_source text,
  fertilizing_interval_days integer,
  fertilizing_source text,
  light_requirement text,
  humidity_preference text,
  temperature_min integer,
  temperature_max integer,
  soil_type text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Logs table
create table plant_logs (
  id uuid primary key default uuid_generate_v4(),
  plant_id uuid references plants(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  type log_type not null,
  date date not null default current_date,
  note text,
  photo_url text,
  issue_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index plants_user_id_idx on plants(user_id);
create index plants_status_idx on plants(status);
create index plants_next_watered_idx on plants(next_watered_at) where archived_at is null;
create index plants_next_fertilized_idx on plants(next_fertilized_at) where archived_at is null;
create index plant_logs_plant_id_idx on plant_logs(plant_id);
create index plant_logs_user_id_idx on plant_logs(user_id);
create index plant_logs_date_idx on plant_logs(date desc);

-- Updated_at trigger
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger plants_updated_at
  before update on plants
  for each row execute function update_updated_at_column();

create trigger plant_logs_updated_at
  before update on plant_logs
  for each row execute function update_updated_at_column();

-- Row Level Security
alter table plants enable row level security;
alter table plant_logs enable row level security;

-- Plants RLS policies
create policy "Users can view their own plants"
  on plants for select
  using (auth.uid() = user_id);

create policy "Users can insert their own plants"
  on plants for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own plants"
  on plants for update
  using (auth.uid() = user_id);

create policy "Users can delete their own plants"
  on plants for delete
  using (auth.uid() = user_id);

-- Plant logs RLS policies
create policy "Users can view their own logs"
  on plant_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert their own logs"
  on plant_logs for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own logs"
  on plant_logs for update
  using (auth.uid() = user_id);

create policy "Users can delete their own logs"
  on plant_logs for delete
  using (auth.uid() = user_id);

-- Storage bucket for plant and log photos
insert into storage.buckets (id, name, public) values ('plant-photos', 'plant-photos', true);

create policy "Authenticated users can upload photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'plant-photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Anyone can view photos"
  on storage.objects for select
  using (bucket_id = 'plant-photos');

create policy "Users can update their own photos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'plant-photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can delete their own photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'plant-photos' and auth.uid()::text = (storage.foldername(name))[1]);
