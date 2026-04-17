import type { Plant } from '@/lib/types'

/**
 * Reference conditions for the base watering interval:
 * plastic pot, 15 cm diameter × 15 cm height, medium light, spring (Mar–May).
 *
 * Multipliers are derived from the horticultural literature:
 *  - Pot material: controlled studies show terracotta loses ~35–45% more water
 *    than plastic; porous sidewall evaporation is measurably higher.
 *  - Pot size: water reservoir scales with volume; larger pots stay moist longer.
 *    Interval ∝ (actual_volume / ref_volume)^0.35 (damped — roots and substrate
 *    heterogeneity reduce the linearity).
 *  - Light: high light stimulates stomata, increases transpiration.
 *  - Season: daylight hours + temperature proxy for evapotranspiration demand.
 */

const REF_VOLUME_CM3 = Math.PI * (15 / 2) ** 2 * 15 // ~2651 cm³

export function computeSmartWateringInterval(plant: Plant): number | null {
  const base = plant.watering_interval_days
  if (!base) return null

  let f = 1.0

  // ── Pot material ─────────────────────────────────────────────────────────
  // Terracotta loses ~55–66% of the water plastic does in the same conditions,
  // meaning it needs watering ~1.5–1.8× more often.
  if (plant.pot_type === 'terracotta') f *= 0.65        // water ~35% more often
  else if (plant.pot_type === 'stoneware') f *= 0.85    // slightly more porous than plastic
  else if (plant.pot_type === 'glass')    f *= 0.97     // non-porous but similar to plastic

  // ── Pot size (volume relative to 15 cm reference) ────────────────────────
  if (plant.pot_diameter_cm && plant.pot_height_cm) {
    const vol = Math.PI * (plant.pot_diameter_cm / 2) ** 2 * plant.pot_height_cm
    // Larger pot → more water held → can go longer between waterings
    f *= Math.pow(vol / REF_VOLUME_CM3, 0.35)
  }

  // ── Light requirement ────────────────────────────────────────────────────
  if      (plant.light_requirement === 'low')            f *= 1.30  // less ET, water less often
  else if (plant.light_requirement === 'bright_indirect') f *= 0.85
  else if (plant.light_requirement === 'direct')         f *= 0.75  // high ET, water more often

  // ── Season (northern-hemisphere proxy) ───────────────────────────────────
  const month = new Date().getMonth() + 1 // 1–12
  if      (month >= 12 || month <= 2) f *= 1.40  // winter:  low light, cool → slow ET
  else if (month >= 6  && month <= 8) f *= 0.85  // summer:  long days, warm → fast ET
  else if (month >= 9  && month <= 11) f *= 1.15 // autumn:  days shortening
  // spring (3–5) → reference × 1.0

  return Math.max(1, Math.round(base * f))
}

/**
 * Describes what changed from the base interval, for debug / logging.
 */
export function describeInterval(plant: Plant): string {
  const base = plant.watering_interval_days
  const smart = computeSmartWateringInterval(plant)
  if (!base || !smart) return 'no base interval'
  const pct = Math.round(((smart - base) / base) * 100)
  const dir = pct > 0 ? `+${pct}%` : `${pct}%`
  return `${base}d base → ${smart}d adjusted (${dir})`
}
