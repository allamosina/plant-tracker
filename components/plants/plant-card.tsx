'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { MapPin } from 'lucide-react'
import { differenceInCalendarDays, isPast, isToday, parseISO, startOfToday } from 'date-fns'
import { PlantStatusBadge } from './plant-status-badge'
import type { Plant } from '@/lib/types'

interface PlantCardProps {
  plant: Plant
  compact?: boolean
}

function countdownLabel(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null
  const d = parseISO(dateStr)
  if (isPast(d) && !isToday(d)) return 'Overdue'
  if (isToday(d)) return 'Today'
  const diff = differenceInCalendarDays(d, startOfToday())
  return `in ${diff}d`
}

export function PlantCard({ plant, compact = false }: PlantCardProps) {
  const waterLabel = countdownLabel(plant.next_watered_at)
  const waterOverdue = waterLabel === 'Overdue'

  return (
    <motion.div whileTap={{ scale: 0.98 }} className="h-full">
      <Link
        href={`/plants/${plant.id}`}
        className={`block bg-stone-100 rounded-xl overflow-hidden border border-stone-300 h-full flex ${
          compact
            ? 'flex-row items-center p-3 gap-4 min-w-[280px]'
            : 'flex-col'
        }`}
        style={{ boxShadow: '0 2px 12px -2px rgba(0,0,0,0.06)' }}
      >
        <div
          className={`${
            compact ? 'w-16 h-16 rounded-lg flex-shrink-0' : 'w-full aspect-square'
          } bg-stone-200 flex items-center justify-center overflow-hidden relative`}
        >
          {plant.photo_url ? (
            <Image
              src={plant.photo_url}
              alt={plant.name}
              fill
              className="object-cover"
              sizes={compact ? '64px' : '(max-width: 512px) 50vw, 256px'}
            />
          ) : (
            <span className={compact ? 'text-2xl' : 'text-5xl'}>🪴</span>
          )}
          {waterOverdue && !compact && (
            <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-clay-400 shadow-sm" title="Overdue watering" />
          )}
        </div>

        <div className={`flex flex-col flex-1 ${compact ? '' : 'p-3'}`}>
          <h3 className="font-medium text-leaf-700 truncate pr-2 mb-1 text-sm">
            {plant.nickname ?? plant.name}
          </h3>

          {!compact && (plant.species || plant.location) && (
            <p className="text-[10px] text-olive-500 truncate mb-2 flex items-center gap-1">
              {plant.location && <MapPin size={9} className="shrink-0" />}
              {plant.location ?? plant.species}
            </p>
          )}

          <div className={`flex flex-wrap items-center gap-1.5 ${compact ? 'mt-1' : 'mt-auto pt-1'}`}>
            <PlantStatusBadge status={plant.status} />
            {!compact && waterLabel && (
              <span
                className={`text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md ${
                  waterOverdue
                    ? 'bg-clay-400/15 text-clay-500'
                    : waterLabel === 'Today'
                    ? 'bg-leaf-500/15 text-leaf-600'
                    : 'bg-stone-200 text-stone-500'
                }`}
              >
                💧 {waterLabel}
              </span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
