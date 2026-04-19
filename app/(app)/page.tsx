'use client'

import { useState, useEffect, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { format, isToday, isTomorrow, isPast, parseISO, startOfToday, differenceInCalendarDays, addDays } from 'date-fns'
import { Droplets, Sprout, Wind, CheckCircle2, Plus, HelpCircle, Leaf } from 'lucide-react'
import { toast } from 'sonner'
import { useUpcomingTasks } from '@/lib/hooks/use-plants'
import { useSiteLocations } from '@/lib/hooks/use-locations'
import { useCreateLog } from '@/lib/hooks/use-logs'
import { Skeleton } from '@/components/ui/skeleton'
import { generateWateringRecommendation } from '@/lib/actions/generate-recommendation'
import { computeSmartWateringInterval, computeSmartFertilizingInterval, computeSmartMistingInterval, computeCheckSoilInterval } from '@/lib/utils/smart-interval'
import { createClient } from '@/lib/supabase/client'
import type { UpcomingTask, Plant } from '@/lib/types'

// ─── helpers ────────────────────────────────────────────────────────────────

function bucketLabel(dateStr: string): string {
  const d = parseISO(dateStr)
  const today = startOfToday()
  if (isPast(d) && !isToday(d)) return 'Overdue'
  if (isToday(d)) return 'Today'
  if (isTomorrow(d)) return 'Tomorrow'
  const diff = differenceInCalendarDays(d, today)
  if (diff <= 7) return `In ${diff} days`
  return 'Later'
}

const BUCKET_ORDER = ['Overdue', 'Today', 'Tomorrow', 'In 2 days', 'In 3 days', 'In 4 days', 'In 5 days', 'In 6 days', 'In 7 days', 'Later']

function sortBucket(a: string, b: string) {
  const ai = BUCKET_ORDER.indexOf(a)
  const bi = BUCKET_ORDER.indexOf(b)
  if (ai === -1 && bi === -1) return a.localeCompare(b)
  if (ai === -1) return 1
  if (bi === -1) return -1
  return ai - bi
}

function groupByBucket(tasks: UpcomingTask[]): Map<string, UpcomingTask[]> {
  const map = new Map<string, UpcomingTask[]>()
  for (const task of tasks) {
    const label = bucketLabel(task.dueDate)
    if (!map.has(label)) map.set(label, [])
    map.get(label)!.push(task)
  }
  return new Map([...map.entries()].sort((a, b) => sortBucket(a[0], b[0])))
}

// ─── action config ───────────────────────────────────────────────────────────

const ACTION_CONFIG = {
  watering:    { label: 'Water',      icon: Droplets, color: 'bg-leaf-500/10 text-leaf-600 border-leaf-400/30' },
  misting:     { label: 'Mist',       icon: Wind,     color: 'bg-sky-100 text-sky-600 border-sky-300/40' },
  fertilizing: { label: 'Fertilize',  icon: Sprout,   color: 'bg-olive-400/10 text-olive-600 border-olive-400/30' },
  check_soil:  { label: 'Check soil', icon: Leaf,     color: 'bg-amber-100 text-amber-700 border-amber-200' },
}

// ─── watering info sheet ──────────────────────────────────────────────────────

function WateringSheet({
  task,
  geoLat,
  onClose,
  onComplete,
  onSnooze,
}: {
  task: UpcomingTask
  geoLat: number | null
  onClose: () => void
  onComplete: () => void
  onSnooze: () => void
}) {
  const plant = task.plant
  const [recommendation, setRecommendation] = useState<string | null>(
    plant.watering_recommendation ?? null,
  )
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (recommendation) return
    setGenerating(true)
    generateWateringRecommendation({
      name: plant.name,
      species: plant.species,
      pot_type: plant.pot_type,
      pot_diameter_cm: plant.pot_diameter_cm,
      pot_height_cm: plant.pot_height_cm,
      has_drainage: plant.has_drainage,
      light_requirement: plant.light_requirement,
      humidity_preference: plant.humidity_preference,
      soil_type: plant.soil_type,
      watering_interval_days: computeSmartWateringInterval(plant, geoLat) ?? plant.watering_interval_days,
    })
      .then((text) => {
        setRecommendation(text)
        if (text) {
          // Persist so next open is instant
          createClient()
            .from('plants')
            .update({
              watering_recommendation: text,
              watering_recommendation_updated_at: new Date().toISOString(),
            })
            .eq('id', plant.id)
            .then(() => {})
        }
      })
      .finally(() => setGenerating(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const smartInterval = computeSmartWateringInterval(plant, geoLat)

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-stone-50 rounded-t-2xl shadow-2xl px-5 pt-5 pb-8 max-w-lg mx-auto">
        {/* Handle */}
        <div className="w-10 h-1 bg-stone-300 rounded-full mx-auto mb-5" />

        {/* Plant header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-xl bg-stone-200 overflow-hidden relative flex-shrink-0">
            {plant.photo_url ? (
              <Image src={plant.photo_url} alt={plant.name} fill className="object-cover" sizes="48px" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xl">🪴</div>
            )}
          </div>
          <div>
            <h3 className="font-medium text-leaf-700">{plant.nickname ?? plant.name}</h3>
            {plant.species && (
              <p className="text-xs text-stone-500 italic">{plant.species}</p>
            )}
          </div>
          <div className="ml-auto flex items-center gap-1 px-2 py-1 rounded-lg bg-leaf-500/10 border border-leaf-400/30 text-[10px] font-semibold uppercase tracking-wide text-leaf-600">
            <Droplets size={11} />
            Water
          </div>
        </div>

        {/* Smart interval info */}
        {smartInterval && smartInterval !== plant.watering_interval_days && (
          <div className="mb-4 px-3 py-2 bg-stone-100 border border-stone-200 rounded-lg text-[11px] text-stone-500">
            Interval adjusted to <span className="font-medium text-leaf-700">every {smartInterval} days</span>
            {' '}(base {plant.watering_interval_days}d, tuned for {[
              plant.pot_type,
              plant.light_requirement?.replace('_', ' '),
              (() => { const m = new Date().getMonth() + 1; return m >= 12 || m <= 2 ? 'winter' : m >= 6 && m <= 8 ? 'summer' : m >= 9 ? 'autumn' : null })(),
            ].filter(Boolean).join(', ')})
          </div>
        )}

        {/* Recommendation */}
        <div className="mb-6 min-h-[80px]">
          {generating ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-full" />
            </div>
          ) : recommendation ? (
            <div className="space-y-2">
              {recommendation.split('\n').filter(l => l.trim()).map((line, i) => (
                <p key={i} className="text-sm text-olive-700 leading-relaxed">{line}</p>
              ))}
            </div>
          ) : (
            <p className="text-sm text-stone-400 italic">No recommendation available yet.</p>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <button
            onClick={onComplete}
            className="w-full flex items-center justify-center gap-2 bg-leaf-500 text-stone-50 font-medium py-3.5 rounded-xl hover:bg-leaf-600 transition-colors"
          >
            <CheckCircle2 size={18} />
            Done — I watered it
          </button>
          <button
            onClick={onSnooze}
            className="w-full flex items-center justify-center gap-2 bg-stone-100 border border-stone-300 text-olive-600 font-medium py-3 rounded-xl hover:bg-stone-200 transition-colors text-sm"
          >
            Soil is still wet — remind me in 3 days
          </button>
        </div>
      </div>
    </>
  )
}

// ─── check soil sheet ─────────────────────────────────────────────────────────

function CheckSoilSheet({
  task,
  onClose,
  onWatered,
  onCheckLater,
}: {
  task: UpcomingTask
  onClose: () => void
  onWatered: () => void
  onCheckLater: () => void
}) {
  const plant = task.plant
  const interval = computeCheckSoilInterval(plant)

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-stone-50 rounded-t-2xl shadow-2xl px-5 pt-5 pb-8 max-w-lg mx-auto">
        <div className="w-10 h-1 bg-stone-300 rounded-full mx-auto mb-5" />

        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-xl bg-stone-200 overflow-hidden relative flex-shrink-0">
            {plant.photo_url ? (
              <Image src={plant.photo_url} alt={plant.name} fill className="object-cover" sizes="48px" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xl">🪴</div>
            )}
          </div>
          <div>
            <h3 className="font-medium text-leaf-700">{plant.nickname ?? plant.name}</h3>
            {plant.species && <p className="text-xs text-stone-500 italic">{plant.species}</p>}
          </div>
          <div className="ml-auto flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-100 border border-amber-200 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
            <Leaf size={11} />
            Check soil
          </div>
        </div>

        <p className="text-sm text-stone-600 mb-6 leading-relaxed">
          No watering history yet. Stick your finger ~2 cm into the soil — is it dry?
        </p>

        <div className="space-y-2">
          <button
            onClick={onWatered}
            className="w-full flex items-center justify-center gap-2 bg-leaf-500 text-stone-50 font-medium py-3.5 rounded-xl hover:bg-leaf-600 transition-colors"
          >
            <CheckCircle2 size={18} />
            Yes, dry — I watered it
          </button>
          <button
            onClick={onCheckLater}
            className="w-full flex items-center justify-center gap-2 bg-stone-100 border border-stone-300 text-olive-600 font-medium py-3 rounded-xl hover:bg-stone-200 transition-colors text-sm"
          >
            Still moist — check again in {interval} {interval === 1 ? 'day' : 'days'}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── task item ───────────────────────────────────────────────────────────────

function TaskItem({
  task,
  onComplete,
  onOpenSheet,
}: {
  task: UpcomingTask
  onComplete: () => void
  onOpenSheet?: () => void
}) {
  const cfg = ACTION_CONFIG[task.type]
  const Icon = cfg.icon
  const overdue = isPast(parseISO(task.dueDate)) && !isToday(parseISO(task.dueDate))

  return (
    <div
      className={`flex items-center gap-3 bg-stone-100 rounded-xl p-3 border ${overdue ? 'border-clay-400/40' : 'border-stone-300'}`}
      style={{ boxShadow: '0 2px 12px -2px rgba(0,0,0,0.06)' }}
    >
      {/* Thumbnail */}
      <Link href={`/plants/${task.plant.id}`} className="flex-shrink-0">
        <div className="w-11 h-11 rounded-lg bg-stone-200 overflow-hidden relative">
          {task.plant.photo_url ? (
            <Image src={task.plant.photo_url} alt={task.plant.name} fill className="object-cover" sizes="44px" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-lg">🪴</div>
          )}
        </div>
      </Link>

      {/* Plant info */}
      <Link href={`/plants/${task.plant.id}`} className="flex-1 min-w-0">
        <p className="text-sm font-medium text-leaf-700 truncate">{task.plant.nickname ?? task.plant.name}</p>
        {task.plant.location && (
          <p className="text-[10px] text-stone-500 mt-0.5">{task.plant.location}</p>
        )}
      </Link>

      {/* Action badge */}
      {(task.type === 'watering' || task.type === 'check_soil') && onOpenSheet ? (
        <button
          onClick={onOpenSheet}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-semibold uppercase tracking-wide ${cfg.color}`}
          aria-label={task.type === 'watering' ? 'Watering guide' : 'Check soil'}
        >
          <Icon size={11} />
          {cfg.label}
          {task.type === 'watering' && <HelpCircle size={10} className="opacity-60 ml-0.5" />}
        </button>
      ) : (
        <div className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-semibold uppercase tracking-wide ${cfg.color}`}>
          <Icon size={11} />
          {cfg.label}
        </div>
      )}

      {/* Complete button — check_soil must go through the sheet */}
      {task.type !== 'check_soil' && (
        <button
          onClick={onComplete}
          className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-stone-300 hover:text-leaf-500 hover:bg-leaf-500/10 transition-colors"
          aria-label="Mark done"
        >
          <CheckCircle2 size={22} />
        </button>
      )}
    </div>
  )
}

// ─── bucket header ────────────────────────────────────────────────────────────

function BucketHeader({ label, count }: { label: string; count: number }) {
  const overdue = label === 'Overdue'
  return (
    <div className="flex items-center justify-between mb-2 mt-6 first:mt-0">
      <h2 className={`text-xs font-semibold uppercase tracking-[0.12em] ${overdue ? 'text-clay-500' : 'text-leaf-700'}`}>
        {label}
      </h2>
      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${overdue ? 'bg-clay-400/15 text-clay-500' : 'bg-stone-200 text-stone-500'}`}>
        {count}
      </span>
    </div>
  )
}

// ─── empty states ─────────────────────────────────────────────────────────────

function AllCaughtUp() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[55vh] text-center px-8">
      <div className="w-20 h-20 rounded-full bg-leaf-500/10 border border-leaf-400/20 flex items-center justify-center mb-5">
        <CheckCircle2 size={36} className="text-leaf-500" />
      </div>
      <h2 className="text-lg font-medium text-leaf-700 mb-2">All caught up!</h2>
      <p className="text-sm text-olive-500 mb-6">No upcoming care tasks. Your plants are happy.</p>
      <Link
        href="/plants/new"
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-leaf-500 text-stone-50 text-sm font-medium rounded-xl hover:bg-leaf-600 transition-colors"
      >
        <Plus size={16} /> Add a plant
      </Link>
    </div>
  )
}

function NoPlants() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[55vh] text-center px-8">
      <div className="text-5xl mb-5">🌱</div>
      <h2 className="text-lg font-medium text-leaf-700 mb-2">Welcome to LeafLog</h2>
      <p className="text-sm text-olive-500 mb-6">Add your first plant to start tracking care tasks.</p>
      <Link
        href="/plants/new"
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-leaf-500 text-stone-50 text-sm font-medium rounded-xl hover:bg-leaf-600 transition-colors"
      >
        <Plus size={16} /> Add your first plant
      </Link>
    </div>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const { tasks, isLoading } = useUpcomingTasks()
  const { data: siteLocations } = useSiteLocations()
  const createLog = useCreateLog()
  const [sheetTask, setSheetTask] = useState<UpcomingTask | null>(null)
  const [checkSoilTask, setCheckSoilTask] = useState<UpcomingTask | null>(null)

  const locationMap = useMemo(
    () => new Map((siteLocations ?? []).map((l) => [l.name, l])),
    [siteLocations],
  )

  async function handleComplete(task: UpcomingTask) {
    if (task.type === 'check_soil') return
    const { plant, type } = task
    const loc = locationMap.get(plant.location ?? '')
    const geoLat = loc?.geo_lat ?? null
    const smartWateringInterval = computeSmartWateringInterval(plant, geoLat)
    const fertResult = computeSmartFertilizingInterval(plant, geoLat)
    const smartFertilizingInterval = fertResult && !fertResult.suspended ? fertResult.days : null
    const smartMistingInterval = computeSmartMistingInterval(plant, loc?.humidity, loc?.light_level)
    try {
      await createLog.mutateAsync({
        plant_id: plant.id,
        type,
        date: format(new Date(), 'yyyy-MM-dd'),
        note: null,
        issue_description: null,
        photo_url: null,
        wateringIntervalDays: smartWateringInterval ?? plant.watering_interval_days,
        mistingIntervalDays: smartMistingInterval ?? plant.misting_interval_days,
        fertilizingIntervalDays: smartFertilizingInterval ?? plant.fertilizing_interval_days,
      })
      toast.success(`${ACTION_CONFIG[type].label}ing logged for ${plant.nickname ?? plant.name}`)
    } catch {
      toast.error('Failed to log care')
    }
  }

  async function handleCheckSoilWatered(task: UpcomingTask) {
    const { plant } = task
    const loc = locationMap.get(plant.location ?? '')
    const geoLat = loc?.geo_lat ?? null
    const smartWateringInterval = computeSmartWateringInterval(plant, geoLat)
    const fertResult = computeSmartFertilizingInterval(plant, geoLat)
    const smartFertilizingInterval = fertResult && !fertResult.suspended ? fertResult.days : null
    const smartMistingInterval = computeSmartMistingInterval(plant, loc?.humidity, loc?.light_level)
    try {
      await createLog.mutateAsync({
        plant_id: plant.id,
        type: 'watering',
        date: format(new Date(), 'yyyy-MM-dd'),
        note: null,
        issue_description: null,
        photo_url: null,
        wateringIntervalDays: smartWateringInterval ?? plant.watering_interval_days,
        mistingIntervalDays: smartMistingInterval ?? plant.misting_interval_days,
        fertilizingIntervalDays: smartFertilizingInterval ?? plant.fertilizing_interval_days,
      })
      toast.success(`Watering logged for ${plant.nickname ?? plant.name}`)
    } catch {
      toast.error('Failed to log care')
    }
    setCheckSoilTask(null)
  }

  async function handleCheckAgainLater(task: UpcomingTask) {
    const interval = computeCheckSoilInterval(task.plant)
    const newDate = format(addDays(new Date(), interval), 'yyyy-MM-dd')
    try {
      await createClient()
        .from('plants')
        .update({ next_check_soil_at: newDate })
        .eq('id', task.plant.id)
      window.dispatchEvent(new Event('focus'))
      toast.success(`Check soil again on ${format(parseISO(newDate), 'MMM d')}`)
    } catch {
      toast.error('Failed to reschedule')
    }
    setCheckSoilTask(null)
  }

  async function handleSnooze(task: UpcomingTask) {
    const plant = task.plant
    // Push next_watered_at forward by 3 days from today (or from current due date if in future)
    const fromDate = task.dueDate > format(new Date(), 'yyyy-MM-dd') ? task.dueDate : format(new Date(), 'yyyy-MM-dd')
    const newDate = format(addDays(parseISO(fromDate), 3), 'yyyy-MM-dd')
    try {
      await createClient()
        .from('plants')
        .update({ next_watered_at: newDate })
        .eq('id', plant.id)
      // Invalidate via a page-level refetch is handled by TanStack Query stale-time;
      // force it by pushing a window event that the query cache will pick up on next focus
      window.dispatchEvent(new Event('focus'))
      toast.success(`Watering rescheduled to ${format(parseISO(newDate), 'MMM d')}`)
    } catch {
      toast.error('Failed to snooze')
    }
    setSheetTask(null)
  }

  const grouped = groupByBucket(tasks)

  return (
    <div className="pb-24 min-h-screen bg-stone-50">
      <header className="sticky top-0 z-40 bg-stone-50/80 backdrop-blur-md px-4 pt-5 pb-4">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-xl font-medium text-leaf-700">Tasks</h1>
            <p className="text-xs text-olive-500 mt-0.5">{format(new Date(), 'EEEE, MMMM d')}</p>
          </div>
          {tasks.length > 0 && (
            <span className="text-xs font-medium text-stone-500 bg-stone-200 rounded-full px-2.5 py-1">
              {tasks.length} pending
            </span>
          )}
        </div>
      </header>

      <main className="px-4 py-2">
        {isLoading ? (
          <div className="space-y-3 pt-4">
            <Skeleton className="h-4 w-20" />
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : tasks.length === 0 && !isLoading ? (
          <NoPlants />
        ) : grouped.size === 0 ? (
          <AllCaughtUp />
        ) : (
          <div className="pt-1">
            {[...grouped.entries()].map(([label, bucket]) => (
              <div key={label}>
                <BucketHeader label={label} count={bucket.length} />
                <div className="space-y-2 mb-2">
                  {bucket.map((task) => (
                    <TaskItem
                      key={task.key}
                      task={task}
                      onComplete={() => handleComplete(task)}
                      onOpenSheet={
                        task.type === 'watering' ? () => setSheetTask(task)
                        : task.type === 'check_soil' ? () => setCheckSoilTask(task)
                        : undefined
                      }
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Check soil sheet */}
      {checkSoilTask && (
        <CheckSoilSheet
          task={checkSoilTask}
          onClose={() => setCheckSoilTask(null)}
          onWatered={() => handleCheckSoilWatered(checkSoilTask)}
          onCheckLater={() => handleCheckAgainLater(checkSoilTask)}
        />
      )}

      {/* Watering sheet */}
      {sheetTask && (
        <WateringSheet
          task={sheetTask}
          geoLat={locationMap.get(sheetTask.plant.location ?? '')?.geo_lat ?? null}
          onClose={() => setSheetTask(null)}
          onComplete={() => {
            handleComplete(sheetTask)
            setSheetTask(null)
          }}
          onSnooze={() => handleSnooze(sheetTask)}
        />
      )}
    </div>
  )
}
