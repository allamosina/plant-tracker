'use server'

import Anthropic from '@anthropic-ai/sdk'

interface PlantInput {
  name: string
  species: string | null
  pot_type: string | null
  pot_diameter_cm: number | null
  pot_height_cm: number | null
  light_requirement: string | null
  humidity_preference: string | null
  soil_type: string | null
  watering_interval_days: number | null
}

/**
 * Generates a concise, plant-specific watering guide using Claude.
 * Call once per plant; cache the result in plants.watering_recommendation.
 */
export async function generateWateringRecommendation(
  plant: PlantInput,
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  const potDesc = [
    plant.pot_type ? plant.pot_type : null,
    plant.pot_diameter_cm ? `${plant.pot_diameter_cm} cm Ø` : null,
    plant.pot_height_cm ? `${plant.pot_height_cm} cm tall` : null,
  ]
    .filter(Boolean)
    .join(', ')

  // Estimate pot volume for water-volume hint
  let volumeHint = ''
  if (plant.pot_diameter_cm && plant.pot_height_cm) {
    const vol = Math.PI * (plant.pot_diameter_cm / 2) ** 2 * plant.pot_height_cm
    const ml = Math.round((vol * 0.25) / 10) * 10 // ~¼ pot volume as a rough guide
    volumeHint = `Pot volume ≈ ${Math.round(vol)} cm³ (aim for roughly ${ml} ml per watering as a starting point).`
  }

  const context = [
    plant.species ? `Species: ${plant.species}` : `Plant: ${plant.name}`,
    potDesc ? `Pot: ${potDesc}` : null,
    plant.pot_type === 'terracotta'
      ? 'Note: terracotta is porous — it dries significantly faster than plastic.'
      : null,
    plant.light_requirement ? `Light: ${plant.light_requirement.replace('_', ' ')}` : null,
    plant.humidity_preference ? `Humidity preference: ${plant.humidity_preference}` : null,
    plant.soil_type ? `Soil: ${plant.soil_type}` : null,
    plant.watering_interval_days
      ? `Typical interval: every ${plant.watering_interval_days} days (adjusted for season/pot).`
      : null,
    volumeHint || null,
  ]
    .filter(Boolean)
    .join('\n')

  try {
    const client = new Anthropic({ apiKey })
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 320,
      messages: [
        {
          role: 'user',
          content: `Write a short, practical watering guide for this houseplant. Use exactly 4 bullet points, each one sentence.

${context}

Cover these four points in order:
1. Technique — water thoroughly until it drains (or for no-drainage pots, water carefully in small amounts).
2. Volume — roughly how much water to use based on the pot size given above.
3. When to check — what to look for before the next watering (soil depth, pot weight, leaf signs).
4. Any important note — specific to this plant species or pot material.

Style: friendly, direct, no jargon. Start each bullet with •. No headers. No extra text outside the bullets.`,
        },
      ],
    })

    const text = (msg.content[0] as { type: 'text'; text: string }).text.trim()
    return text
  } catch (err) {
    console.error('[generate-recommendation] error:', err)
    return null
  }
}
