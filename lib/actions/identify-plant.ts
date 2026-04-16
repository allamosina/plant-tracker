'use server'

import Anthropic from '@anthropic-ai/sdk'

export interface PlantIdentification {
  species: string
  commonName: string
}

/**
 * Sends a base64-encoded plant photo to Claude Vision and returns the
 * identified species + common name, or null if it can't be determined.
 *
 * The image should be resized to ≤1024px on the longest side before
 * calling this (done client-side in the form).
 */
export async function identifyPlantFromPhoto(
  imageBase64: string,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp',
): Promise<PlantIdentification | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  try {
    const client = new Anthropic({ apiKey })
    const msg = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 128,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mimeType, data: imageBase64 },
            },
            {
              type: 'text',
              text: `Identify the plant species in this photo. Reply with ONLY a valid JSON object — no markdown, no explanation:
{"species": "<scientific name>", "commonName": "<common name>"}
If you cannot identify the plant with reasonable confidence, reply: {"species": null, "commonName": null}`,
            },
          ],
        },
      ],
    })

    const text = (msg.content[0] as { type: 'text'; text: string }).text.trim()
    const jsonStr = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    const parsed = JSON.parse(jsonStr)
    if (!parsed.species) return null
    return { species: parsed.species as string, commonName: parsed.commonName as string }
  } catch (err) {
    console.error('[identify-plant] error:', err)
    return null
  }
}
