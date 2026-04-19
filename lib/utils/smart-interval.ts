import type { Plant } from '@/lib/types'

// ─── archetypes ───────────────────────────────────────────────────────────────

type Archetype = 'succulent' | 'regular' | 'moisture_loving'

const ARCHETYPE_CONFIG: Record<Archetype, { base: number; min: number; max: number }> = {
  succulent:       { base: 18, min: 10, max: 45 },
  regular:         { base: 9,  min: 4,  max: 21 },
  moisture_loving: { base: 5,  min: 2,  max: 10 },
}

const SUCCULENT_KEYWORDS = /succulent|cactus|aloe|agave|echeveria|sedum|haworthia|jade|euphorbia|stonecrop|sempervivum/i
const MOISTURE_KEYWORDS  = /fern|calathea|peace.?lily|anthurium|orchid|bromeliad|carnivorous|pitcher.?plant|sundew|boston.?fern|maidenhair/i

function classifyArchetype(plant: Plant): Archetype {
  if (plant.humidity_preference === 'low') return 'succulent'
  if (plant.humidity_preference === 'high') return 'moisture_loving'
  // keyword fallback on species, name, soil_type
  const text = [plant.species, plant.name, plant.soil_type].filter(Boolean).join(' ')
  if (SUCCULENT_KEYWORDS.test(text)) return 'succulent'
  if (MOISTURE_KEYWORDS.test(text))  return 'moisture_loving'
  return 'regular'
}

// ─── season ───────────────────────────────────────────────────────────────────

function seasonMultiplier(geoLat?: number | null): number {
  const month = new Date().getMonth() + 1 // 1–12
  // Convert to northern-hemisphere equivalent so formula is hemisphere-agnostic
  const isNorthern = geoLat == null || geoLat >= 0
  const m = isNorthern ? month : ((month + 5) % 12) + 1
  if (m === 12 || m <= 2) return 1.35  // winter: slow growth, less ET
  if (m >= 6  && m <= 8)  return 0.85  // summer: fast growth, high ET
  return 1.0                            // spring / autumn: reference
}

// ─── main export ─────────────────────────────────────────────────────────────

export function computeSmartWateringInterval(plant: Plant, geoLat?: number | null): number | null {
  if (!plant.watering_interval_days) return null

  const { base, min, max } = ARCHETYPE_CONFIG[classifyArchetype(plant)]

  let f = 1.0

  // Season (hemisphere-aware)
  f *= seasonMultiplier(geoLat)

  // Light
  if (plant.light_requirement === 'direct')          f *= 0.85
  else if (plant.light_requirement === 'low')        f *= 1.25

  // Pot material
  if (plant.pot_type === 'terracotta') f *= 0.8

  // Drainage: no drainage hole → soil stays wet longer
  if (plant.has_drainage === false) f *= 1.35

  // Pot size
  if (plant.pot_diameter_cm != null) {
    if      (plant.pot_diameter_cm < 10) f *= 0.9
    else if (plant.pot_diameter_cm > 20) f *= 1.1
  }

  return Math.max(min, Math.min(max, Math.round(base * f)))
}

export function describeInterval(plant: Plant, geoLat?: number | null): string {
  const smart = computeSmartWateringInterval(plant, geoLat)
  if (!smart) return 'no schedule set'
  const base = ARCHETYPE_CONFIG[classifyArchetype(plant)].base
  const pct = Math.round(((smart - base) / base) * 100)
  const dir = pct > 0 ? `+${pct}%` : `${pct}%`
  return `archetype base ${base}d → ${smart}d (${dir})`
}

// ─── post-repot watering delay ────────────────────────────────────────────────

// Days after repotting before the first watering, per archetype:
//   succulent:       7d — damaged roots must callous before moisture hits them
//   regular:         2d — brief sealing period for any root breaks
//   moisture_loving: 1d — high transpiration; can't tolerate longer dryness
const POST_REPOT_WATERING_DELAY: Record<Archetype, number> = {
  succulent:       7,
  regular:         2,
  moisture_loving: 1,
}

/**
 * Returns the number of days after repotting before the first watering,
 * or null if the rule does not apply (no repot data, already watered after
 * repotting, or the delay window has already passed).
 *
 * When non-null, next_watered_at should be max(interval-based, repot_date + delay).
 */
export function computePostRepotWateringDelay(plant: Plant): number | null {
  if (!plant.last_repotted_at) return null
  // Already watered after repotting — delay has been served
  if (plant.last_watered_at && plant.last_watered_at >= plant.last_repotted_at) return null
  const delay = POST_REPOT_WATERING_DELAY[classifyArchetype(plant)]
  const daysSinceRepot = Math.floor(
    (Date.now() - new Date(plant.last_repotted_at).getTime()) / 86_400_000,
  )
  // Delay window already passed — don't push the date further out
  if (daysSinceRepot >= delay) return null
  return delay
}

// ─── fertilizing ─────────────────────────────────────────────────────────────

const FERTILIZE_BASE: Record<Archetype, number> = {
  succulent:       45,
  regular:         21,
  moisture_loving: 14,
}

// Season tiers for fertilizing (hemisphere-aware, same conversion as watering)
// Active     (months 4–8):  April–August        — full growing season
// Transition (months 3,9,10): Mar + Sep–Oct     — ramping up / winding down
// Winter     (months 11,12,1,2): Nov–Feb        — dormancy
type FertilizeTier = 'active' | 'transition' | 'winter'

function fertilizeTier(geoLat?: number | null): FertilizeTier {
  const month = new Date().getMonth() + 1
  const isNorthern = geoLat == null || geoLat >= 0
  const m = isNorthern ? month : ((month + 5) % 12) + 1
  if (m >= 4 && m <= 8)  return 'active'
  if (m === 3 || (m >= 9 && m <= 10)) return 'transition'
  return 'winter'
}

function lightIsBright(plant: Plant): boolean {
  return plant.light_requirement === 'direct' || plant.light_requirement === 'bright_indirect'
}

function fLight(plant: Plant): number {
  if (plant.light_requirement === 'direct') return 0.85
  if (plant.light_requirement === 'low')    return 1.4
  return 1.0 // bright_indirect or null → reference
}

export type FertilizingSchedule =
  | { suspended: false; days: number; tier: FertilizeTier }
  | { suspended: true; reason: 'repotted_recently' | 'winter_low_light' }

/**
 * Returns the smart fertilizing interval, or a suspension reason.
 * Returns null when no fertilizing schedule has been configured for the plant.
 *
 * Hard rules (checked before any calculation):
 *   1. < 30 days since repotting → suspend (fresh potting mix is already rich)
 *   2. Winter tier + non-bright light → suspend (plant is dormant)
 *
 * Reminder (enforced by UI, not this function):
 *   Always fertilize after watering, never into dry soil.
 */
export function computeSmartFertilizingInterval(
  plant: Plant,
  geoLat?: number | null,
): FertilizingSchedule | null {
  if (!plant.fertilizing_interval_days) return null

  // Hard rule 1: recent repotting
  if (plant.last_repotted_at) {
    const daysSince = Math.floor(
      (Date.now() - new Date(plant.last_repotted_at).getTime()) / 86_400_000,
    )
    if (daysSince < 30) return { suspended: true, reason: 'repotted_recently' }
  }

  const tier = fertilizeTier(geoLat)
  const bright = lightIsBright(plant)

  // Hard rule 2: winter + non-bright light → suspend
  if (tier === 'winter' && !bright) return { suspended: true, reason: 'winter_low_light' }

  const F0 = FERTILIZE_BASE[classifyArchetype(plant)]
  const fl = fLight(plant)

  let days: number
  if (tier === 'active') {
    days = F0 * fl
  } else if (tier === 'transition') {
    days = F0 * fl * 1.5
  } else {
    // Winter, bright light only
    days = F0 * fl * 1.75
  }

  // Fertilizing-specific clamps (different scale to watering)
  const FCLAMP = { succulent: [30, 90], regular: [14, 60], moisture_loving: [10, 42] } as const
  const [fMin, fMax] = FCLAMP[classifyArchetype(plant)]
  return { suspended: false, days: Math.round(Math.max(fMin, Math.min(fMax, days))), tier }
}
