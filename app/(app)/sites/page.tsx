'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { MapPin, ChevronRight, Leaf, Trash2, Sun, Droplets } from 'lucide-react'
import { isPast, parseISO } from 'date-fns'
import { toast } from 'sonner'
import { usePlants } from '@/lib/hooks/use-plants'
import { useSiteLocations, useDeleteSiteLocation } from '@/lib/hooks/use-locations'
import { Skeleton } from '@/components/ui/skeleton'
import type { Plant, SiteLocation } from '@/lib/types'

// ─── helpers ────────────────────────────────────────────────────────────────

function groupByLocation(plants: Plant[]): Map<string, Plant[]> {
  const map = new Map<string, Plant[]>()
  for (const plant of plants) {
    const site = plant.location?.trim() || '(No location)'
    if (!map.has(site)) map.set(site, [])
    map.get(site)!.push(plant)
  }
  return map
}

// ─── plant photo mosaic (fallback when no location photos) ───────────────────

function PlantMosaic({ plants }: { plants: Plant[] }) {
  const shown = plants.slice(0, 4)
  const cols = shown.length === 1 ? 1 : 2
  return (
    <div
      className={`flex-shrink-0 rounded-xl overflow-hidden bg-stone-200 ${cols === 1 ? 'w-20 h-20' : 'w-20 h-20 grid gap-0.5 grid-cols-2 grid-rows-2'}`}
    >
      {shown.map((p) => (
        <div key={p.id} className="relative overflow-hidden bg-stone-300">
          {p.photo_url ? (
            <Image src={p.photo_url} alt={p.name} fill className="object-cover" sizes="40px" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm">🪴</div>
          )}
        </div>
      ))}
      {shown.length === 0 && (
        <div className="w-full h-full flex items-center justify-center text-2xl">📍</div>
      )}
    </div>
  )
}

// ─── env tags ────────────────────────────────────────────────────────────────

const LOCATION_TYPE_EMOJI: Record<string, string> = {
  indoor_home:    '🏠',
  greenhouse:     '🌡️',
  outdoor_garden: '🌳',
  balcony_patio:  '🏡',
  office:         '💼',
  other:          '📍',
}

const LOCATION_TYPE_LABEL: Record<string, string> = {
  indoor_home:    'Indoor home',
  greenhouse:     'Greenhouse',
  outdoor_garden: 'Garden',
  balcony_patio:  'Balcony / patio',
  office:         'Office',
  other:          'Other',
}

const LIGHT_LABELS: Record<string, string> = {
  low: 'Low light',
  medium: 'Medium light',
  bright_indirect: 'Bright indirect',
  direct: 'Full sun',
}

// ─── swipeable row ───────────────────────────────────────────────────────────

interface SwipeableRowProps {
  children: React.ReactNode
  onDelete: () => void
  onTap: () => void
}

function SwipeableRow({ children, onDelete, onTap }: SwipeableRowProps) {
  const [offsetX, setOffsetX] = useState(0)
  const [hasTransition, setHasTransition] = useState(true)

  const isDragging = useRef(false)
  const startX = useRef(0)
  const startY = useRef(0)
  const startOffset = useRef(0)
  const direction = useRef<'h' | 'v' | null>(null)
  const didMove = useRef(false)
  const currentOffset = useRef(0)
  const DELETE_WIDTH = 80

  function handlePointerDown(e: React.PointerEvent) {
    isDragging.current = true
    startX.current = e.clientX
    startY.current = e.clientY
    startOffset.current = currentOffset.current
    direction.current = null
    didMove.current = false
    setHasTransition(false)
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!isDragging.current) return
    const dx = e.clientX - startX.current
    const dy = e.clientY - startY.current

    if (!direction.current) {
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return
      direction.current = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v'
      if (direction.current === 'h') {
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      } else {
        isDragging.current = false
        setHasTransition(true)
        return
      }
    }

    didMove.current = true
    const newX = Math.max(-DELETE_WIDTH, Math.min(0, startOffset.current + dx))
    currentOffset.current = newX
    setOffsetX(newX)
  }

  function handlePointerUp() {
    if (!isDragging.current) return
    isDragging.current = false
    setHasTransition(true)
    if (direction.current === 'h') {
      const snap = currentOffset.current < -(DELETE_WIDTH * 0.45) ? -DELETE_WIDTH : 0
      currentOffset.current = snap
      setOffsetX(snap)
    }
  }

  function handleClick(e: React.MouseEvent) {
    if (didMove.current) {
      didMove.current = false
      e.preventDefault()
      return
    }
    if (currentOffset.current !== 0) {
      currentOffset.current = 0
      setHasTransition(true)
      setOffsetX(0)
      return
    }
    onTap()
  }

  return (
    <div
      className="relative overflow-hidden rounded-xl"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        isDragging.current = false
        currentOffset.current = 0
        setHasTransition(true)
        setOffsetX(0)
      }}
    >
      {/* Delete background */}
      <div className="absolute inset-y-0 right-0 w-20 flex flex-col items-center justify-center bg-red-500 rounded-r-xl gap-1">
        <button
          className="w-full h-full flex flex-col items-center justify-center text-white gap-1"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
        >
          <Trash2 size={18} />
          <span className="text-[10px] font-semibold">Delete</span>
        </button>
      </div>
      {/* Slide content */}
      <div
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: hasTransition ? 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
        }}
        onClick={handleClick}
      >
        {children}
      </div>
    </div>
  )
}

// ─── site card ───────────────────────────────────────────────────────────────

function SiteCard({
  name,
  plants,
  location,
}: {
  name: string
  plants: Plant[]
  location?: SiteLocation
}) {
  const overdue = plants.filter(
    (p) => p.next_watered_at && isPast(parseISO(p.next_watered_at))
  ).length
  const locationPhoto = location?.photo_urls?.[0]

  return (
    <div
      className="flex items-center gap-4 p-4 bg-stone-100 rounded-xl border border-stone-300 select-none"
      style={{ boxShadow: '0 2px 12px -2px rgba(0,0,0,0.06)' }}
    >
      {locationPhoto ? (
        <div className="w-20 h-20 rounded-xl overflow-hidden relative flex-shrink-0">
          <Image src={locationPhoto} alt={name} fill className="object-cover" sizes="80px" />
        </div>
      ) : (
        <PlantMosaic plants={plants} />
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          {location?.location_type
            ? <span className="text-sm leading-none flex-shrink-0">{LOCATION_TYPE_EMOJI[location.location_type]}</span>
            : <MapPin size={12} className="text-stone-400 flex-shrink-0" />
          }
          <h3 className="text-sm font-semibold text-leaf-700 truncate">{name}</h3>
        </div>
        {location?.location_type && (
          <p className="text-[10px] text-stone-400 mb-0.5">
            {LOCATION_TYPE_LABEL[location.location_type]}
          </p>
        )}
        <p className="text-[11px] text-stone-500">
          {plants.length} {plants.length === 1 ? 'plant' : 'plants'}
          {overdue > 0 && (
            <span className="ml-1.5 text-clay-500 font-medium">· {overdue} overdue</span>
          )}
        </p>
        {location?.geo_city && (
          <p className="text-[10px] text-stone-400 mt-0.5">
            📍 {location.geo_city}{location.geo_country ? `, ${location.geo_country}` : ''}
          </p>
        )}
        {(location?.light_level || location?.humidity) && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {location.light_level && (
              <span className="inline-flex items-center gap-0.5 text-[10px] bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5 font-medium">
                <Sun size={9} />
                {LIGHT_LABELS[location.light_level] ?? location.light_level}
              </span>
            )}
            {location.humidity && (
              <span className="inline-flex items-center gap-0.5 text-[10px] bg-sky-100 text-sky-600 border border-sky-200 rounded-full px-2 py-0.5 font-medium capitalize">
                <Droplets size={9} />
                {location.humidity}
              </span>
            )}
          </div>
        )}
      </div>

      <ChevronRight size={16} className="text-stone-400 flex-shrink-0" />
    </div>
  )
}

// ─── unassigned plants (non-swipeable, inline list) ─────────────────────────

function UnassignedCard({ plants }: { plants: Plant[] }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div
      className="bg-stone-100 rounded-xl border border-stone-300 overflow-hidden"
      style={{ boxShadow: '0 2px 12px -2px rgba(0,0,0,0.06)' }}
    >
      <button
        className="w-full flex items-center gap-4 p-4"
        onClick={() => setExpanded(!expanded)}
      >
        <PlantMosaic plants={plants} />
        <div className="flex-1 min-w-0 text-left">
          <h3 className="text-sm font-medium text-stone-500 mb-0.5">No location set</h3>
          <p className="text-[11px] text-stone-400">
            {plants.length} {plants.length === 1 ? 'plant' : 'plants'}
          </p>
        </div>
        <ChevronRight
          size={16}
          className={`text-stone-400 flex-shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
        />
      </button>
      {expanded && (
        <div className="border-t border-stone-200">
          {plants.map((plant) => (
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
              <p className="flex-1 text-sm font-medium text-leaf-700 truncate">
                {plant.nickname ?? plant.name}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function SitesPage() {
  const router = useRouter()
  const { data: plants, isLoading: plantsLoading } = usePlants()
  const { data: siteLocations } = useSiteLocations()
  const deleteSite = useDeleteSiteLocation()

  const plantGroups = useMemo(() => groupByLocation(plants ?? []), [plants])
  const locationMap = useMemo(
    () => new Map((siteLocations ?? []).map((l) => [l.name, l])),
    [siteLocations]
  )

  // Merge named locations: from plants + from locations table (some may have 0 plants)
  const namedLocations = useMemo(() => {
    const names = new Set<string>()
    for (const [name] of plantGroups) {
      if (name !== '(No location)') names.add(name)
    }
    for (const loc of siteLocations ?? []) {
      names.add(loc.name)
    }
    return [...names].sort((a, b) => a.localeCompare(b))
  }, [plantGroups, siteLocations])

  const unassigned = plantGroups.get('(No location)') ?? []
  const hasAnyData = namedLocations.length > 0 || unassigned.length > 0

  async function handleDelete(name: string) {
    const plantCount = (plantGroups.get(name) ?? []).length
    const msg = plantCount > 0
      ? `Delete "${name}"? This will remove the location from ${plantCount} ${plantCount === 1 ? 'plant' : 'plants'}.`
      : `Delete "${name}"?`
    if (!confirm(msg)) return
    try {
      await deleteSite.mutateAsync(name)
      toast.success(`"${name}" deleted`)
    } catch {
      toast.error('Failed to delete site')
    }
  }

  return (
    <div className="pb-24 min-h-screen bg-stone-50">
      <header className="sticky top-0 z-40 bg-stone-50/80 backdrop-blur-md px-4 pt-5 pb-4">
        <h1 className="text-xl font-medium text-leaf-700">Sites</h1>
        <p className="text-xs text-olive-500 mt-0.5">Tap a site to manage it · swipe to delete</p>
      </header>

      <main className="px-4 py-2">
        {plantsLoading ? (
          <div className="space-y-3 pt-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : !hasAnyData ? (
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
            {namedLocations.map((name) => (
              <SwipeableRow
                key={name}
                onDelete={() => handleDelete(name)}
                onTap={() => router.push(`/sites/${encodeURIComponent(name)}`)}
              >
                <SiteCard
                  name={name}
                  plants={plantGroups.get(name) ?? []}
                  location={locationMap.get(name)}
                />
              </SwipeableRow>
            ))}

            {unassigned.length > 0 && (
              <UnassignedCard plants={unassigned} />
            )}
          </div>
        )}
      </main>
    </div>
  )
}
