'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { MapPin, ChevronRight, Leaf } from 'lucide-react'
import { isPast, parseISO } from 'date-fns'
import { usePlants } from '@/lib/hooks/use-plants'
import { PlantStatusBadge } from '@/components/plants/plant-status-badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { Plant } from '@/lib/types'

// ─── helpers ────────────────────────────────────────────────────────────────

function groupBySite(plants: Plant[]): Map<string, Plant[]> {
  const map = new Map<string, Plant[]>()
  for (const plant of plants) {
    const site = plant.location?.trim() || '(No location)'
    if (!map.has(site)) map.set(site, [])
    map.get(site)!.push(plant)
  }
  // Sort: named sites first (alphabetical), unassigned last
  return new Map(
    [...map.entries()].sort((a, b) => {
      if (a[0] === '(No location)') return 1
      if (b[0] === '(No location)') return -1
      return a[0].localeCompare(b[0])
    })
  )
}

// ─── photo mosaic ─────────────────────────────────────────────────────────────

function SitePhotoGrid({ plants }: { plants: Plant[] }) {
  const shown = plants.slice(0, 4)
  const cols = shown.length === 1 ? 1 : 2

  return (
    <div className={`grid gap-0.5 rounded-xl overflow-hidden flex-shrink-0 ${cols === 1 ? 'w-20 h-20' : 'w-20 h-20 grid-cols-2 grid-rows-2'}`}>
      {shown.map((p) => (
        <div key={p.id} className="bg-stone-200 relative overflow-hidden">
          {p.photo_url ? (
            <Image src={p.photo_url} alt={p.name} fill className="object-cover" sizes="40px" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-base">🪴</div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── env tags ────────────────────────────────────────────────────────────────

const LIGHT_LABELS: Record<string, string> = {
  low: 'Low light',
  medium: 'Medium light',
  bright_indirect: 'Bright indirect',
  direct: 'Full sun',
}

function EnvTags({ plants }: { plants: Plant[] }) {
  const lights = [...new Set(plants.map((p) => p.light_requirement).filter(Boolean))] as string[]
  const humids = [...new Set(plants.map((p) => p.humidity_preference).filter(Boolean))] as string[]

  if (!lights.length && !humids.length) return null

  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {lights.slice(0, 2).map((l) => (
        <span key={l} className="text-[10px] bg-leaf-500/10 text-leaf-600 border border-leaf-400/20 rounded-full px-2 py-0.5 font-medium">
          {LIGHT_LABELS[l] ?? l}
        </span>
      ))}
      {humids.slice(0, 1).map((h) => (
        <span key={h} className="text-[10px] bg-sky-100 text-sky-600 border border-sky-200 rounded-full px-2 py-0.5 font-medium capitalize">
          {h} humidity
        </span>
      ))}
    </div>
  )
}

// ─── site card ───────────────────────────────────────────────────────────────

function SiteCard({ name, plants }: { name: string; plants: Plant[] }) {
  const [expanded, setExpanded] = useState(false)
  const isUnassigned = name === '(No location)'
  const overdue = plants.filter(
    (p) => p.next_watered_at && isPast(parseISO(p.next_watered_at))
  ).length

  return (
    <div className="bg-stone-100 rounded-xl border border-stone-300 overflow-hidden" style={{ boxShadow: '0 2px 12px -2px rgba(0,0,0,0.06)' }}>
      {/* Header row */}
      <button
        className="w-full flex items-center gap-4 p-4"
        onClick={() => setExpanded(!expanded)}
      >
        <SitePhotoGrid plants={plants} />

        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-1.5 mb-0.5">
            {!isUnassigned && <MapPin size={12} className="text-stone-400 flex-shrink-0" />}
            <h3 className="text-sm font-medium text-leaf-700 truncate">
              {isUnassigned ? 'No location set' : name}
            </h3>
          </div>
          <p className="text-[11px] text-stone-500">
            {plants.length} {plants.length === 1 ? 'plant' : 'plants'}
            {overdue > 0 && (
              <span className="ml-1.5 text-clay-500 font-medium">· {overdue} overdue</span>
            )}
          </p>
          <EnvTags plants={plants} />
        </div>

        <ChevronRight
          size={18}
          className={`text-stone-400 flex-shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
        />
      </button>

      {/* Expanded plant list */}
      {expanded && (
        <div className="border-t border-stone-200">
          {plants.map((plant) => {
            const needsWater = plant.next_watered_at && isPast(parseISO(plant.next_watered_at))
            return (
              <Link
                key={plant.id}
                href={`/plants/${plant.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-stone-200/60 transition-colors border-b border-stone-200/60 last:border-0"
              >
                <div className="w-9 h-9 rounded-lg bg-stone-200 overflow-hidden relative flex-shrink-0">
                  {plant.photo_url ? (
                    <Image src={plant.photo_url} alt={plant.name} fill className="object-cover" sizes="36px" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm">🪴</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-leaf-700 truncate">{plant.nickname ?? plant.name}</p>
                  {plant.species && <p className="text-[10px] text-olive-500 truncate italic">{plant.species}</p>}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <PlantStatusBadge status={plant.status} />
                  {needsWater && (
                    <span className="text-[9px] font-semibold text-clay-500 uppercase tracking-wide">Water now</span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function SitesPage() {
  const { data: plants, isLoading } = usePlants()
  const grouped = plants ? groupBySite(plants) : new Map<string, Plant[]>()

  return (
    <div className="pb-24 min-h-screen bg-stone-50">
      <header className="sticky top-0 z-40 bg-stone-50/80 backdrop-blur-md px-4 pt-5 pb-4">
        <h1 className="text-xl font-medium text-leaf-700">Sites</h1>
        <p className="text-xs text-olive-500 mt-0.5">Plants grouped by location</p>
      </header>

      <main className="px-4 py-2">
        {isLoading ? (
          <div className="space-y-3 pt-2">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : !plants?.length ? (
          <div className="flex flex-col items-center justify-center min-h-[55vh] text-center px-8">
            <div className="w-16 h-16 rounded-full bg-stone-200 border border-stone-300 flex items-center justify-center mb-4">
              <Leaf size={28} className="text-stone-400" />
            </div>
            <p className="text-olive-500 text-sm mb-4">No plants yet. Add one to see sites.</p>
            <Link
              href="/plants/new"
              className="px-5 py-2.5 bg-leaf-500 text-stone-50 text-sm font-medium rounded-xl hover:bg-leaf-600 transition-colors"
            >
              Add plant
            </Link>
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            {[...grouped.entries()].map(([name, plants]) => (
              <SiteCard key={name} name={name} plants={plants} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
