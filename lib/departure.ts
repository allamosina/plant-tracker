import { differenceInCalendarDays, format, formatDuration, intervalToDuration, parseISO } from 'date-fns'
import type { DepartureReason, Plant } from '@/lib/types'

export const HEAVEN_PATH = '/plants/heaven'
export const REHOMED_PATH = '/plants/rehomed'

export const DEPARTURE_REASONS: Record<
  DepartureReason,
  {
    emoji: string
    choice: string        // shown in the goodbye sheet
    label: string         // short label on cards
    notePlaceholder: string
    farewell: (name: string) => string
    path: string
  }
> = {
  passed_away: {
    emoji: '🕊',
    choice: 'It passed away',
    label: 'Passed away',
    notePlaceholder: 'What happened? A few words to remember it by (optional)',
    farewell: (name) => `Rest well, ${name} 🌿`,
    path: HEAVEN_PATH,
  },
  given_away: {
    emoji: '🤝',
    choice: 'I gave it away',
    label: 'Given away',
    notePlaceholder: 'Who has it now? (optional)',
    farewell: (name) => `${name} has a new home 💚`,
    path: REHOMED_PATH,
  },
  left_behind: {
    emoji: '🏠',
    choice: 'It stayed at my old home',
    label: 'Stayed behind',
    notePlaceholder: 'Anything to remember about it? (optional)',
    farewell: (name) => `${name} is keeping your old home green 🏠`,
    path: REHOMED_PATH,
  },
}

/** Where a departed plant lives: Plant Heaven or Rehomed (unsorted ones go to Rehomed). */
export function departurePath(plant: Pick<Plant, 'departure_reason'>): string {
  return plant.departure_reason ? DEPARTURE_REASONS[plant.departure_reason].path : REHOMED_PATH
}

export function displayName(plant: Pick<Plant, 'name' | 'nickname'>): string {
  return plant.nickname ?? plant.name
}

// ─── time together ────────────────────────────────────────────────────────────

function startDate(plant: Plant): Date {
  return parseISO(plant.acquisition_date ?? plant.created_at)
}

function endDate(plant: Plant): Date {
  return plant.archived_at ? parseISO(plant.archived_at) : new Date()
}

/** "Mar 2023 — Oct 2026" */
export function lifeSpanLabel(plant: Plant): string {
  const start = format(startDate(plant), 'MMM yyyy')
  const end = format(endDate(plant), 'MMM yyyy')
  return start === end ? start : `${start} — ${end}`
}

/** "2 years 7 months" / "12 days" */
export function timeTogetherLabel(plant: Plant): string {
  const start = startDate(plant)
  const end = endDate(plant)
  const days = differenceInCalendarDays(end, start)
  if (days < 1) return 'less than a day'
  if (days < 31) return `${days} ${days === 1 ? 'day' : 'days'}`
  const duration = intervalToDuration({ start, end })
  return formatDuration(duration, { format: ['years', 'months'] }) || `${days} days`
}

// ─── quotes ───────────────────────────────────────────────────────────────────
// Original lines, intentionally unattributed.

export const HEAVEN_QUOTES = [
  'Every leaf it grew was a small thank-you.',
  'It turned light into green for you. That still counts.',
  'Some plants stay for a season, some for years. Each one taught you something.',
  'You gave it water, light and attention. That was love, even when it wasn’t enough.',
  'Nothing that grew in your care was wasted.',
  'Gardeners don’t lose plants. They learn from them.',
  'It lived, it grew, it was loved. That’s a whole story.',
  'The soil remembers. So do you.',
]

export const REHOMED_QUOTES = [
  'Some plants are meant to keep growing somewhere else.',
  'Letting go is part of caring, too.',
  'Somewhere, a windowsill is a little greener because of you.',
  'A plant you shared is a plant that keeps growing.',
  'You gave them roots. Now they have a new home.',
  'Not gone — just growing elsewhere.',
]

/** Same quote all day, a new one tomorrow. */
export function quoteOfTheDay(quotes: string[], date = new Date()): string {
  const dayIndex = Math.floor(date.getTime() / 86_400_000)
  return quotes[dayIndex % quotes.length]
}
