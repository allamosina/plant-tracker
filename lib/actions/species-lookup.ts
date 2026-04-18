'use server'

import Anthropic from '@anthropic-ai/sdk'

const PERENUAL_KEY = process.env.PERENUAL_API_KEY

// Perenual watering → days
const WATERING_MAP: Record<string, number> = {
  frequent: 5,
  average: 10,
  minimum: 21,
}

// Perenual sunlight array → light requirement
function mapSunlight(sunlight: string[]): string | null {
  if (!sunlight?.length) return null
  const s = sunlight[0].toLowerCase()
  if (s.includes('full sun')) return 'direct'
  if (s.includes('part sun') || s.includes('part shade')) return 'bright_indirect'
  if (s.includes('filtered') || s.includes('indirect')) return 'bright_indirect'
  if (s.includes('full shade') || s.includes('deep shade')) return 'low'
  return 'medium'
}

export interface CareProfile {
  wateringIntervalDays: number
  wateringSource: 'perenual' | 'claude'
  mistingIntervalDays: number | null
  fertilizingIntervalDays: number | null
  lightRequirement: string | null
  humidityPreference: string | null
  soilType: string | null
  temperatureMin: number | null
  temperatureMax: number | null
}

export interface PlantSuggestion {
  scientificName: string
  commonName: string
}

export async function searchPlantSpecies(query: string): Promise<PlantSuggestion[]> {
  if (query.trim().length < 2) return []
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicKey) return []
  try {
    const client = new Anthropic({ apiKey: anthropicKey })
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `List up to 6 real houseplant or garden plant species matching "${query}".
Reply with ONLY a valid JSON array — no markdown, no extra text:
[{"scientificName":"Monstera deliciosa","commonName":"Swiss Cheese Plant"},...]
Only include real species. If nothing matches, return [].`,
      }],
    })
    const text = (msg.content[0] as { type: 'text'; text: string }).text.trim()
    const jsonStr = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    const parsed = JSON.parse(jsonStr)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((p): p is PlantSuggestion =>
        typeof p?.scientificName === 'string' && typeof p?.commonName === 'string'
      )
      .slice(0, 6)
  } catch {
    return []
  }
}

export async function lookupCareProfile(species: string): Promise<CareProfile | null> {
  let perenualData: Partial<CareProfile> | null = null

  // 1. Try Perenual API
  if (PERENUAL_KEY) {
    try {
      const url = `https://perenual.com/api/species-list?q=${encodeURIComponent(species)}&key=${PERENUAL_KEY}`
      const res = await fetch(url, { cache: 'force-cache' })
      if (res.ok) {
        const json = await res.json()
        const match = json.data?.[0]
        if (match) {
          const wateringDays = WATERING_MAP[match.watering?.toLowerCase()]
          if (wateringDays) {
            perenualData = {
              wateringIntervalDays: wateringDays,
              wateringSource: 'perenual',
              lightRequirement: mapSunlight(match.sunlight),
            }
          }
        }
      }
    } catch {
      // fall through
    }
  }

  // 2. Claude for the full profile (or fill gaps from Perenual)
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicKey) {
    if (perenualData?.wateringIntervalDays) {
      return {
        wateringIntervalDays: perenualData.wateringIntervalDays,
        wateringSource: 'perenual',
        mistingIntervalDays: null,
        fertilizingIntervalDays: null,
        lightRequirement: perenualData.lightRequirement ?? null,
        humidityPreference: null,
        soilType: null,
        temperatureMin: null,
        temperatureMax: null,
      }
    }
    return null
  }

  try {
    const client = new Anthropic({ apiKey: anthropicKey })
    const msg = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: `For the houseplant "${species}", reply with ONLY a valid JSON object — no markdown, no explanation:
{
  "wateringIntervalDays": <integer, typical days between waterings>,
  "mistingIntervalDays": <integer or null, days between misting — null if plant doesn't benefit from misting>,
  "fertilizingIntervalDays": <integer, days between fertilizing, typically 14-30 during growing season>,
  "lightRequirement": <"low" | "medium" | "bright_indirect" | "direct">,
  "humidityPreference": <"low" | "medium" | "high">,
  "soilType": <string, short description like "well-draining potting mix">,
  "temperatureMin": <integer celsius or null>,
  "temperatureMax": <integer celsius or null>
}`,
        },
      ],
    })

    const text = (msg.content[0] as { type: 'text'; text: string }).text.trim()
    // Strip any accidental markdown fences
    const jsonStr = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    const parsed = JSON.parse(jsonStr)

    const wateringDays =
      perenualData?.wateringIntervalDays ??
      (Number.isInteger(parsed.wateringIntervalDays) ? parsed.wateringIntervalDays : null)

    if (!wateringDays) return null

    return {
      wateringIntervalDays: wateringDays,
      wateringSource: perenualData?.wateringIntervalDays ? 'perenual' : 'claude',
      mistingIntervalDays:
        Number.isInteger(parsed.mistingIntervalDays) ? parsed.mistingIntervalDays : null,
      fertilizingIntervalDays:
        Number.isInteger(parsed.fertilizingIntervalDays) ? parsed.fertilizingIntervalDays : null,
      lightRequirement:
        perenualData?.lightRequirement ??
        (['low', 'medium', 'bright_indirect', 'direct'].includes(parsed.lightRequirement)
          ? parsed.lightRequirement
          : null),
      humidityPreference:
        ['low', 'medium', 'high'].includes(parsed.humidityPreference)
          ? parsed.humidityPreference
          : null,
      soilType: typeof parsed.soilType === 'string' ? parsed.soilType : null,
      temperatureMin: Number.isInteger(parsed.temperatureMin) ? parsed.temperatureMin : null,
      temperatureMax: Number.isInteger(parsed.temperatureMax) ? parsed.temperatureMax : null,
    }
  } catch {
    // Claude failed — return what we have from Perenual
    if (perenualData?.wateringIntervalDays) {
      return {
        wateringIntervalDays: perenualData.wateringIntervalDays,
        wateringSource: 'perenual',
        mistingIntervalDays: null,
        fertilizingIntervalDays: null,
        lightRequirement: perenualData.lightRequirement ?? null,
        humidityPreference: null,
        soilType: null,
        temperatureMin: null,
        temperatureMax: null,
      }
    }
    return null
  }
}

export const lookupWateringInterval = async (species: string) => {
  const profile = await lookupCareProfile(species)
  if (!profile) return null
  return { intervalDays: profile.wateringIntervalDays, source: profile.wateringSource }
}
