'use client'

import Image from 'next/image'
import Link from 'next/link'
import { format, isToday, isTomorrow, isPast, parseISO, startOfToday, differenceInCalendarDays } from 'date-fns'
import { Droplets, Sprout, Wind, CheckCircle2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useUpcomingTasks } from '@/lib/hooks/use-plants'
import { useCreateLog } from '@/lib/hooks/use-logs'
import { Skeleton } from '@/components/ui/skeleton'
import type { UpcomingTask } from '@/lib/types'

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
  const sorted = new Map([...map.entries()].sort((a, b) => sortBucket(a[0], b[0])))
  return sorted
}

// ─── action badge ────────────────────────────────────────────────────────────

const ACTION_CONFIG = {
  watering:    { label: 'Water',     icon: Droplets, color: 'bg-leaf-500/10 text-leaf-600 border-leaf-400/30' },
  misting:     { label: 'Mist',      icon: Wind,     color: 'bg-sky-100 text-sky-600 border-sky-300/40' },
  fertilizing: { label: 'Fertilize', icon: Sprout,   color: 'bg-olive-400/10 text-olive-600 border-olive-400/30' },
}

// ─── task item ───────────────────────────────────────────────────────────────

function TaskItem({ task, onComplete }: { task: UpcomingTask; onComplete: () => void }) {
  const cfg = ACTION_CONFIG[task.type]
  const Icon = cfg.icon
  const overdue = isPast(parseISO(task.dueDate)) && !isToday(parseISO(task.dueDate))

  return (
    <div className={`flex items-center gap-3 bg-stone-100 rounded-xl p-3 border ${overdue ? 'border-clay-400/40' : 'border-stone-300'}`} style={{ boxShadow: '0 2px 12px -2px rgba(0,0,0,0.06)' }}>
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
      <div className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-semibold uppercase tracking-wide ${cfg.color}`}>
        <Icon size={11} />
        {cfg.label}
      </div>

      {/* Complete button */}
      <button
        onClick={onComplete}
        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-stone-300 hover:text-leaf-500 hover:bg-leaf-500/10 transition-colors"
        aria-label="Mark done"
      >
        <CheckCircle2 size={22} />
      </button>
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

// ─── empty state ──────────────────────────────────────────────────────────────

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
      <h2 className="text-lg font-medium text-leaf-700 mb-2">Welcome to Plantwise</h2>
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
  const createLog = useCreateLog()

  async function handleComplete(task: UpcomingTask) {
    const { plant, type } = task
    try {
      await createLog.mutateAsync({
        plant_id: plant.id,
        type,
        date: format(new Date(), 'yyyy-MM-dd'),
        note: null,
        issue_description: null,
        photo_url: null,
        wateringIntervalDays: plant.watering_interval_days,
        mistingIntervalDays: plant.misting_interval_days,
        fertilizingIntervalDays: plant.fertilizing_interval_days,
      })
      toast.success(`${ACTION_CONFIG[type].label}ing logged for ${plant.nickname ?? plant.name}`)
    } catch {
      toast.error('Failed to log care')
    }
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
          // No tasks — either no plants or all caught up; usePlants data comes from same cache
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
                    <TaskItem key={task.key} task={task} onComplete={() => handleComplete(task)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
