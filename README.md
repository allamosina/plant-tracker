# LeafLog

A mobile-first plant care tracker with AI-powered care schedule recommendations.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Setup](#setup)
- [Environment Variables](#environment-variables)
- [Database](#database)
- [AI & Data Flow](#ai--data-flow)
- [Smart Interval System](#smart-interval-system)
- [Key Concepts](#key-concepts)

---

## Features

- **Plant management** — add plants with photos, species, location, and pot details
- **AI species identification** — photograph a plant to auto-detect species and care needs
- **Smart care schedules** — watering, fertilizing, and misting intervals adjusted for season, pot type, light, and climate
- **Care task queue** — daily task list grouped by urgency (overdue → today → upcoming)
- **Check-soil tasks** — new plants with no watering history get a soil-check task before the watering cadence starts
- **Sites / locations** — group plants by room or outdoor space; attach geo coordinates for hemisphere-aware seasonal adjustments
- **Care log history** — timestamped log of all care events per plant
- **Watering recommendations** — Claude-generated plain-language watering guide per plant, cached on the record
- **PWA** — installable on iOS and Android from the browser

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| UI components | shadcn/ui (Base UI) |
| Forms | React Hook Form + Zod |
| Server state | TanStack Query v5 |
| Backend / DB | Supabase (Postgres + Auth + Storage) |
| AI | Anthropic Claude API |
| Plant data | Perenual API (species database) |
| Animations | Framer Motion |
| Date handling | date-fns |

---

## Project Structure

```
├── app/
│   ├── (auth)/                  # Unauthenticated routes
│   │   ├── login/
│   │   ├── register/
│   │   └── forgot-password/
│   └── (app)/                   # Authenticated routes
│       ├── page.tsx             # Home — task queue
│       ├── plants/
│       │   ├── page.tsx         # Plant list
│       │   ├── new/page.tsx     # Add plant
│       │   └── [id]/
│       │       ├── page.tsx     # Plant detail
│       │       └── edit/page.tsx
│       ├── sites/
│       │   ├── page.tsx         # Sites list
│       │   └── [name]/page.tsx  # Site detail + environment settings
│       └── archive/page.tsx
│
├── components/
│   ├── layout/
│   ├── logs/
│   ├── plants/
│   └── ui/                      # shadcn primitives
│
├── lib/
│   ├── actions/                 # Next.js server actions (AI calls)
│   │   ├── identify-plant.ts    # Claude Vision — photo → species
│   │   ├── species-lookup.ts    # Perenual + Claude — species → care profile
│   │   └── generate-recommendation.ts  # Claude — plant → watering guide text
│   ├── hooks/
│   │   ├── use-plants.ts        # Plant CRUD + useUpcomingTasks
│   │   ├── use-logs.ts          # Care log CRUD
│   │   ├── use-locations.ts     # Site CRUD + useReschedulePlantsAtLocation
│   │   └── use-photo-upload.ts
│   ├── supabase/
│   │   ├── client.ts            # Browser Supabase client
│   │   └── server.ts            # Server Supabase client (SSR)
│   ├── utils/
│   │   └── smart-interval.ts    # Deterministic care interval formulas
│   └── types.ts                 # Shared TypeScript interfaces
│
├── supabase/
│   ├── schema.sql               # Base schema
│   └── migrations/              # Incremental migrations (run in Supabase SQL editor)
│
└── public/
    └── manifest.json            # PWA manifest
```

---

## Setup

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project
- An [Anthropic](https://console.anthropic.com) API key
- (Optional) A [Perenual](https://perenual.com/docs/api) API key

### Install

```bash
npm install
npm run dev
```

### Database

Run migrations in order in the Supabase SQL editor:

1. `supabase/schema.sql` — base tables, RLS policies, storage bucket
2. `supabase/migrations/add_watering_knowledge.sql`
3. `supabase/migrations/002_expanded_care.sql`
4. `supabase/migrations/003_watering_recommendation.sql`
5. `supabase/migrations/004_locations.sql`
6. `supabase/migrations/005_location_type.sql`
7. `supabase/migrations/006_location_geo.sql`
8. `supabase/migrations/007_plant_drainage.sql`
9. `supabase/migrations/008_plant_check_soil.sql`

---

## Environment Variables

```env
# Supabase — public, safe to expose to the browser
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Anthropic — server-side only
ANTHROPIC_API_KEY=sk-ant-...

# Perenual — optional, improves species data accuracy
# Free key at https://perenual.com/docs/api
# If not set, all species lookups use Claude only
PERENUAL_API_KEY=sk-...
```

---

## Database

### `plants`

Core table. One row per plant per user.

| Column | Type | Description |
|---|---|---|
| `id` | uuid | Primary key |
| `user_id` | uuid | Owner (references `auth.users`) |
| `name` | text | Display name |
| `nickname` | text | Optional pet name |
| `species` | text | Scientific or common species name |
| `location` | text | Site name (matches `locations.name`) |
| `status` | enum | `healthy` / `needs_attention` / `recovering` |
| `photo_url` | text | Supabase Storage URL |
| `last_watered_at` | date | Last recorded watering |
| `next_watered_at` | date | Computed next watering date |
| `watering_interval_days` | integer | Base interval from species lookup |
| `watering_source` | text | `'perenual'` or `'claude'` |
| `last_misted_at` | date | |
| `next_misted_at` | date | Computed |
| `misting_interval_days` | integer | Set by formula only |
| `misting_source` | text | `'formula'` |
| `last_fertilized_at` | date | |
| `next_fertilized_at` | date | Computed |
| `fertilizing_interval_days` | integer | |
| `last_repotted_at` | date | |
| `next_check_soil_at` | date | Active when plant has no watering history |
| `light_requirement` | text | `low` / `medium` / `bright_indirect` / `direct` |
| `humidity_preference` | text | `low` / `medium` / `high` |
| `temperature_min/max` | integer | °C |
| `soil_type` | text | |
| `pot_type` | text | `plastic` / `terracotta` / `stoneware` / `glass` / `tray` / `other` |
| `pot_diameter_cm` | integer | |
| `pot_height_cm` | integer | |
| `has_drainage` | boolean | Drainage hole present |
| `watering_recommendation` | text | Cached Claude-generated watering guide |
| `archived_at` | timestamptz | Soft delete |

### `plant_logs`

One row per care event.

| Column | Type | Description |
|---|---|---|
| `plant_id` | uuid | References `plants` |
| `type` | enum | `watering` / `misting` / `fertilizing` / `repotting` / `pruning` / `issue_observed` |
| `date` | date | When the care happened |
| `note` | text | Optional note |
| `issue_description` | text | Used for `issue_observed` type |
| `photo_url` | text | Optional photo |

### `locations`

One row per named site.

| Column | Type | Description |
|---|---|---|
| `name` | text | Unique per user; used as string FK from `plants.location` |
| `location_type` | text | `indoor_home` / `greenhouse` / `outdoor_garden` / `balcony_patio` / `office` / `other` |
| `light_level` | text | `low` / `medium` / `bright_indirect` / `direct` |
| `humidity` | text | `low` / `medium` / `high` |
| `geo_lat` / `geo_lng` | float | Coordinates for hemisphere-aware seasonal adjustments |
| `geo_city` / `geo_country` | text | Display only |
| `photo_urls` | text[] | Array of Supabase Storage URLs |
| `notes` | text | |

All tables have RLS enabled — every policy filters on `user_id = auth.uid()`.

---

## AI & Data Flow

### 1. Photo → species

**`identifyPlantFromPhoto`** — Claude Opus 4.6 (vision)  
Fires on photo upload. Returns `{ species, commonName }` to pre-fill the form. Does not affect the care schedule.

### 2. Species → care profile

**`lookupCareProfile`** — Perenual API + Claude Opus 4.6  
Fires when a plant is saved with a new species name.

```
Perenual API (if PERENUAL_API_KEY is set)
  └─ returns watering frequency category + sunlight
  └─ mapped to wateringIntervalDays + lightRequirement

Claude Opus 4.6
  └─ always runs, fills: mistingIntervalDays, fertilizingIntervalDays,
     humidityPreference, soilType, temperatureMin/Max
  └─ Perenual values take priority over Claude for watering + light
```

`plants.watering_source` records which system provided the watering interval: `'perenual'` or `'claude'`.

### 3. Care profile → adjusted schedule

**`smart-interval.ts`** — pure TypeScript, no API  
Applies multipliers to the base interval. See [Smart Interval System](#smart-interval-system).

### 4. Species autocomplete

**`searchPlantSpecies`** — Claude Haiku 4.5  
Debounced at 300 ms on the species input field. Returns up to 6 `{ scientificName, commonName }` suggestions.

### 5. Watering guide text

**`generateWateringRecommendation`** — Claude Haiku 4.5  
Generated lazily when the watering sheet opens, then cached on `plants.watering_recommendation`. Cache is cleared when care-relevant fields change (species, pot, light, location).

---

## Smart Interval System

All schedule math lives in `lib/utils/smart-interval.ts`. Same inputs always produce the same output — no randomness, no AI.

### Plant archetypes

Classification priority: `humidity_preference` field → species/name keyword match → default.

| Archetype | Watering base | Min | Max | Detection |
|---|---|---|---|---|
| `succulent` | 18 days | 10 | 45 | `humidity_preference = 'low'`, or keywords: cactus, aloe, echeveria, sedum… |
| `regular` | 9 days | 4 | 21 | Default |
| `moisture_loving` | 5 days | 2 | 10 | `humidity_preference = 'high'`, or keywords: fern, calathea, orchid, bromeliad… |

### Watering multipliers

| Factor | Multiplier |
|---|---|
| Summer (Jun–Aug, hemisphere-aware) | ×0.85 |
| Winter (Dec–Feb, hemisphere-aware) | ×1.35 |
| Direct light | ×0.85 |
| Low light | ×1.25 |
| Terracotta pot | ×0.80 |
| No drainage hole | ×1.35 |
| Pot diameter < 10 cm | ×0.90 |
| Pot diameter > 20 cm | ×1.10 |

Hemisphere detection uses `locations.geo_lat`. Southern hemisphere flips the season months.

### Fertilizing

Same archetype bases (succulent: 45d, regular: 21d, moisture-loving: 14d) with seasonal tiers:

| Tier | Months | Multiplier |
|---|---|---|
| Active | Apr–Aug | ×1.0 |
| Transition | Mar, Sep–Oct | ×1.5 |
| Winter | Nov–Feb | ×1.75 |

Suspended entirely if: within 30 days of repotting, or winter + non-bright light.

### Misting

Activates only when all three conditions are met:
1. Plant is not a succulent
2. Ambient humidity (from site location) is not `'high'`
3. Light level is not `'low'`

Intervals: moisture-loving = 2 days, regular = 7 days. Always formula-driven — species lookup value is overridden.

### Post-repot watering delay

| Archetype | Delay after repotting |
|---|---|
| Succulent | 7 days |
| Regular | 2 days |
| Moisture-loving | 1 day |

Skipped if the plant was already watered after the repot date, or if the delay window has passed.

### Check-soil task

When a plant is created with a watering schedule but no `last_watered_at`, `next_check_soil_at = today`. The task appears in the home queue with two options:

- **Watered** → logs watering, starts normal cadence, clears the task
- **Check again later** → reschedules (succulent: 6d, regular: 3d, moisture-loving: 1d)

---

## Key Concepts

### Tasks are derived, not stored

No `tasks` table exists. `useUpcomingTasks()` scans all active plants for non-null `next_watered_at`, `next_misted_at`, `next_fertilized_at`, and `next_check_soil_at` values and assembles the queue in memory.

### Location as a string foreign key

`plants.location` stores the site name as plain text matching `locations.name` — no UUID FK. This allows location-less plants and graceful handling when a location record is missing.

### Care log triggers schedule update

`useCreateLog` records the care event and immediately updates `last_*_at`, recomputes `next_*_at`, and clears `next_check_soil_at` (on watering) — all in one Supabase call. The schedule is never left stale after a care action.

### Schedule recalculation on pot/location change

When pot info (type, size, drainage) or location environment (light, humidity, geo) changes, the smart interval formulas run again with the new inputs and the plant record is updated with fresh `watering_interval_days`, `fertilizing_interval_days`, `misting_interval_days`, and recomputed next-due dates.
