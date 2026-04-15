'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  format, parseISO, formatDistanceToNow, isPast, isToday,
  differenceInCalendarDays, startOfToday, addDays,
} from 'date-fns'
import {
  Edit2, MoreVertical, MapPin, Calendar, Archive, Trash2,
  Droplets, Sprout, Wind, CheckCircle2, Sun, Thermometer,
  Leaf,
} from 'lucide-react'
import { toast } from 'sonner'
import { Header } from '@/components/layout/header'
import { usePlant, useArchivePlant, useDeletePlant } from '@/lib/hooks/use-plants'
import { useLogs, useCreateLog } from '@/lib/hooks/use-logs'
import { PlantStatusBadge } from '@/components/plants/plant-status-badge'
import { AddLogSheet } from '@/components/logs/add-log-sheet'
import { LogItem } from '@/components/logs/log-item'
import { Skeleton } from '@/components/ui/skeleton'
import type { Plant } from '@/lib/types'

// ─── care stat carousel ───────────────────────────────────────────────────────

function relativeLabel(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = parseISO(dateStr)
  return formatDistanceToNow(d, { addSuffix: true })
}

function nextLabel(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = parseISO(dateStr)
  if (isPast(d) && !isToday(d)) return 'Overdue'
  if (isToday(d)) return 'Today'
  const diff = differenceInCalendarDays(d, startOfToday())
  return `In ${diff}d`
}

function CareStatCard({
  icon: Icon,
  label,
  last,
  next,
  accent,
  overdue,
}: {
  icon: React.ElementType
  label: string
  last: string | null | undefined
  next: string | null | undefined
  accent: string
  overdue: boolean
}) {
  return (
    <div
      className={`flex-shrink-0 w-36 bg-stone-100 rounded-xl p-3.5 border ${overdue ? 'border-clay-400/40' : 'border-stone-300'}`}
      style={{ boxShadow: '0 2px 12px -2px rgba(0,0,0,0.06)' }}
    >
      <div className={`w-7 h-7 rounded-full flex items-center justify-center mb-2 ${accent}`}>
        <Icon size={15} />
      </div>
      <p className="text-[9px] text-stone-500 uppercase tracking-widest font-medium mb-1">{label}</p>
      <p className="text-xs text-stone-500">Last: <span className="text-leaf-700 font-medium">{relativeLabel(last)}</span></p>
      <p className={`text-xs mt-0.5 ${overdue ? 'text-clay-500 font-semibold' : 'text-stone-500'}`}>
        Next: <span className="font-medium">{nextLabel(next)}</span>
      </p>
    </div>
  )
}

// ─── plant tasks tab ──────────────────────────────────────────────────────────

function PlantTasksTab({ plant }: { plant: Plant }) {
  const createLog = useCreateLog()
  const today = format(new Date(), 'yyyy-MM-dd')

  const allTasks = [
    { type: 'watering' as const, label: 'Water', icon: Droplets, dueDate: plant.next_watered_at, intervalDays: plant.watering_interval_days, color: 'text-leaf-500' },
    { type: 'misting' as const, label: 'Mist', icon: Wind, dueDate: plant.next_misted_at, intervalDays: plant.misting_interval_days, color: 'text-sky-500' },
    { type: 'fertilizing' as const, label: 'Fertilize', icon: Sprout, dueDate: plant.next_fertilized_at, intervalDays: plant.fertilizing_interval_days, color: 'text-olive-500' },
  ]
  const tasks = allTasks.filter((t) => t.dueDate !== null)

  async function complete(type: 'watering' | 'misting' | 'fertilizing') {
    try {
      await createLog.mutateAsync({
        plant_id: plant.id,
        type,
        date: today,
        note: null,
        issue_description: null,
        photo_url: null,
        wateringIntervalDays: plant.watering_interval_days,
        mistingIntervalDays: plant.misting_interval_days,
        fertilizingIntervalDays: plant.fertilizing_interval_days,
      })
      toast.success('Care logged!')
    } catch {
      toast.error('Failed to log care')
    }
  }

  if (!tasks.length) {
    return (
      <div className="py-10 text-center">
        <p className="text-stone-400 text-sm mb-2">No scheduled care tasks.</p>
        <p className="text-xs text-stone-400">Add a species to get auto-detected intervals.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {tasks.map(({ type, label, icon: Icon, dueDate, color }) => {
        const overdue = dueDate && isPast(parseISO(dueDate)) && !isToday(parseISO(dueDate))
        const dueToday = dueDate && isToday(parseISO(dueDate))
        return (
          <div
            key={type}
            className={`flex items-center gap-3 bg-stone-100 rounded-xl p-3.5 border ${overdue ? 'border-clay-400/40' : 'border-stone-300'}`}
            style={{ boxShadow: '0 2px 12px -2px rgba(0,0,0,0.06)' }}
          >
            <div className={`w-9 h-9 rounded-full flex items-center justify-center bg-stone-200 flex-shrink-0 ${color}`}>
              <Icon size={18} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-leaf-700">{label}</p>
              <p className={`text-xs mt-0.5 ${overdue ? 'text-clay-500 font-semibold' : 'text-stone-500'}`}>
                {overdue ? 'Overdue · ' : dueToday ? 'Today · ' : ''}
                {dueDate && format(parseISO(dueDate), 'MMM d')}
              </p>
            </div>
            <button
              onClick={() => complete(type)}
              disabled={createLog.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-leaf-500/10 text-leaf-600 border border-leaf-400/30 rounded-lg text-xs font-medium hover:bg-leaf-500/20 transition-colors disabled:opacity-50"
            >
              <CheckCircle2 size={13} /> Done
            </button>
          </div>
        )
      })}
      <AddLogSheet
        plantId={plant.id}
        wateringIntervalDays={plant.watering_interval_days}
        mistingIntervalDays={plant.misting_interval_days}
        fertilizingIntervalDays={plant.fertilizing_interval_days}
        trigger={
          <button className="w-full py-3 text-sm text-leaf-500 font-medium border border-dashed border-leaf-400/40 rounded-xl hover:bg-leaf-500/5 transition-colors">
            + Log other care
          </button>
        }
      />
    </div>
  )
}

// ─── care info tab ────────────────────────────────────────────────────────────

const LIGHT_LABELS: Record<string, string> = {
  low: 'Low light',
  medium: 'Medium light',
  bright_indirect: 'Bright indirect',
  direct: 'Direct sunlight',
}

const HUMIDITY_LABELS: Record<string, string> = {
  low: 'Low (succulent-like)',
  medium: 'Medium (typical home)',
  high: 'High (tropical)',
}

function InfoRow({ icon: Icon, label, value, accent }: { icon: React.ElementType; label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-stone-200 last:border-0">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${accent ?? 'bg-stone-200 text-stone-500'}`}>
        <Icon size={14} />
      </div>
      <div>
        <p className="text-[10px] text-stone-400 uppercase tracking-wide font-medium">{label}</p>
        <p className="text-sm text-leaf-700 mt-0.5">{value}</p>
      </div>
    </div>
  )
}

function CareInfoTab({ plant }: { plant: Plant }) {
  const hasData = plant.light_requirement || plant.humidity_preference || plant.soil_type || plant.temperature_min || plant.watering_interval_days

  if (!hasData) {
    return (
      <div className="py-10 text-center">
        <p className="text-stone-400 text-sm mb-1">No care profile detected yet.</p>
        <p className="text-xs text-stone-400">
          {plant.species
            ? 'Edit the plant to re-trigger species lookup.'
            : 'Add a species name to auto-detect care requirements.'}
        </p>
      </div>
    )
  }

  return (
    <div className="bg-stone-100 rounded-xl border border-stone-300 px-4" style={{ boxShadow: '0 2px 12px -2px rgba(0,0,0,0.06)' }}>
      {plant.watering_interval_days && (
        <InfoRow
          icon={Droplets}
          label="Watering"
          value={`Every ${plant.watering_interval_days} days`}
          accent="bg-leaf-500/10 text-leaf-500"
        />
      )}
      {plant.misting_interval_days && (
        <InfoRow
          icon={Wind}
          label="Misting"
          value={`Every ${plant.misting_interval_days} days`}
          accent="bg-sky-100 text-sky-500"
        />
      )}
      {plant.fertilizing_interval_days && (
        <InfoRow
          icon={Sprout}
          label="Fertilizing"
          value={`Every ${plant.fertilizing_interval_days} days`}
          accent="bg-olive-400/10 text-olive-500"
        />
      )}
      {plant.light_requirement && (
        <InfoRow
          icon={Sun}
          label="Light"
          value={LIGHT_LABELS[plant.light_requirement] ?? plant.light_requirement}
          accent="bg-amber-100 text-amber-500"
        />
      )}
      {plant.humidity_preference && (
        <InfoRow
          icon={Wind}
          label="Humidity"
          value={HUMIDITY_LABELS[plant.humidity_preference] ?? plant.humidity_preference}
          accent="bg-sky-100 text-sky-500"
        />
      )}
      {plant.soil_type && (
        <InfoRow
          icon={Leaf}
          label="Soil"
          value={plant.soil_type}
          accent="bg-stone-300 text-stone-600"
        />
      )}
      {(plant.temperature_min || plant.temperature_max) && (
        <InfoRow
          icon={Thermometer}
          label="Temperature"
          value={
            plant.temperature_min && plant.temperature_max
              ? `${plant.temperature_min}–${plant.temperature_max}°C`
              : plant.temperature_min
              ? `Min ${plant.temperature_min}°C`
              : `Max ${plant.temperature_max}°C`
          }
          accent="bg-orange-100 text-orange-500"
        />
      )}
      {plant.watering_source && (
        <p className="text-[10px] text-stone-400 py-3 text-center">
          Data source: {plant.watering_source === 'perenual' ? 'Perenual plant database' : 'AI estimate'}
        </p>
      )}
    </div>
  )
}

// ─── history tab ──────────────────────────────────────────────────────────────

function HistoryTab({ plantId, plant }: { plantId: string; plant: Plant }) {
  const { data: logs, isLoading } = useLogs(plantId)

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
    )
  }

  if (!logs?.length) {
    return (
      <div className="py-10 text-center space-y-3">
        <p className="text-stone-400 text-sm">No care logged yet.</p>
        <AddLogSheet
          plantId={plantId}
          wateringIntervalDays={plant.watering_interval_days}
          mistingIntervalDays={plant.misting_interval_days}
          fertilizingIntervalDays={plant.fertilizing_interval_days}
          trigger={
            <button className="text-sm text-leaf-500 font-medium hover:underline">Log first care</button>
          }
        />
      </div>
    )
  }

  return (
    <div className="relative pl-4 border-l border-stone-300 ml-4 space-y-0">
      {logs.map((log) => (
        <LogItem key={log.id} log={log} />
      ))}
    </div>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

type Tab = 'tasks' | 'info' | 'history'

export default function PlantDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [showMenu, setShowMenu] = useState(false)
  const [tab, setTab] = useState<Tab>('tasks')

  const { data: plant, isLoading } = usePlant(id)
  const archivePlant = useArchivePlant()
  const deletePlant = useDeletePlant()

  async function handleArchive() {
    if (!confirm(`Archive ${plant?.name}? You can restore it later.`)) return
    try {
      await archivePlant.mutateAsync(id)
      toast.success('Plant archived')
      router.push('/')
    } catch { toast.error('Failed to archive') }
  }

  async function handleDelete() {
    if (!confirm('Permanently delete this plant and all logs? This cannot be undone.')) return
    try {
      await deletePlant.mutateAsync(id)
      toast.success('Plant deleted')
      router.push('/')
    } catch { toast.error('Failed to delete') }
  }

  if (isLoading) {
    return (
      <>
        <Header title="" showBack transparent />
        <Skeleton className="h-56 w-full" />
        <div className="px-4 py-4 space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      </>
    )
  }

  if (!plant) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <p className="text-stone-500 mb-4">Plant not found</p>
        <button onClick={() => router.push('/')} className="text-leaf-500 font-medium">Go Home</button>
      </div>
    )
  }

  const wateredOverdue = plant.next_watered_at && isPast(parseISO(plant.next_watered_at)) && !isToday(parseISO(plant.next_watered_at))
  const mistedOverdue = plant.next_misted_at && isPast(parseISO(plant.next_misted_at)) && !isToday(parseISO(plant.next_misted_at))
  const fertilizedOverdue = plant.next_fertilized_at && isPast(parseISO(plant.next_fertilized_at)) && !isToday(parseISO(plant.next_fertilized_at))

  return (
    <div className="min-h-screen bg-stone-50 pb-24">
      {/* Floating header */}
      <header className="absolute top-0 left-0 right-0 z-20 px-2 py-4 flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-full bg-stone-50/80 backdrop-blur-md text-leaf-700 hover:bg-stone-200 transition-colors"
        >
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
        </button>

        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 rounded-full bg-stone-50/80 backdrop-blur-md text-leaf-700 hover:bg-stone-200 transition-colors"
          >
            <MoreVertical size={20} />
          </button>
          {showMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-stone-100 rounded-xl shadow-lg border border-stone-300 py-1 z-30">
              <Link
                href={`/plants/${plant.id}/edit`}
                className="flex items-center px-4 py-3 text-sm text-leaf-700 hover:bg-stone-200 transition-colors"
                onClick={() => setShowMenu(false)}
              >
                <Edit2 size={16} className="mr-2" /> Edit Plant
              </Link>
              <button
                onClick={() => { setShowMenu(false); handleArchive() }}
                className="w-full flex items-center px-4 py-3 text-sm text-olive-500 hover:bg-stone-200 transition-colors"
              >
                <Archive size={16} className="mr-2" /> Archive
              </button>
              <button
                onClick={() => { setShowMenu(false); handleDelete() }}
                className="w-full flex items-center px-4 py-3 text-sm text-clay-400 hover:bg-clay-400/10 transition-colors"
              >
                <Trash2 size={16} className="mr-2" /> Delete
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Hero — aspect-video (shorter than square) */}
      <div className="w-full aspect-video bg-stone-200 relative">
        {plant.photo_url ? (
          <Image src={plant.photo_url} alt={plant.name} fill className="object-cover" priority sizes="512px" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-6xl">🪴</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-stone-900/60 via-transparent to-transparent" />

        {/* Name + status overlay */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
          <div className="flex items-end justify-between">
            <div className="flex-1 min-w-0 mr-3">
              <h1 className="text-2xl font-semibold text-white leading-tight truncate">
                {plant.nickname ?? plant.name}
              </h1>
              {plant.species && (
                <p className="text-white/70 text-sm italic truncate">{plant.species}</p>
              )}
            </div>
            <PlantStatusBadge status={plant.status} />
          </div>
        </div>
      </div>

      <main className="px-4 pt-4">
        {/* Meta row */}
        {(plant.location || plant.acquisition_date) && (
          <div className="flex flex-wrap gap-3 text-xs text-stone-500 mb-4">
            {plant.location && (
              <div className="flex items-center gap-1">
                <MapPin size={12} /> {plant.location}
              </div>
            )}
            {plant.acquisition_date && (
              <div className="flex items-center gap-1">
                <Calendar size={12} /> Since {format(parseISO(plant.acquisition_date), 'MMM yyyy')}
              </div>
            )}
          </div>
        )}

        {/* Care stat carousel */}
        <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2 mb-5 -mx-4 px-4">
          <CareStatCard
            icon={Droplets}
            label="Watering"
            last={plant.last_watered_at}
            next={plant.next_watered_at}
            accent="bg-leaf-500/10 text-leaf-500"
            overdue={!!wateredOverdue}
          />
          {plant.misting_interval_days && (
            <CareStatCard
              icon={Wind}
              label="Misting"
              last={plant.last_misted_at}
              next={plant.next_misted_at}
              accent="bg-sky-100 text-sky-500"
              overdue={!!mistedOverdue}
            />
          )}
          <CareStatCard
            icon={Sprout}
            label="Fertilizing"
            last={plant.last_fertilized_at}
            next={plant.next_fertilized_at}
            accent="bg-olive-400/10 text-olive-500"
            overdue={!!fertilizedOverdue}
          />
        </div>

        {/* Notes */}
        {plant.notes && (
          <div className="bg-stone-100 rounded-xl p-4 border border-stone-300 text-sm text-olive-500 whitespace-pre-wrap mb-5" style={{ boxShadow: '0 2px 12px -2px rgba(0,0,0,0.06)' }}>
            {plant.notes}
          </div>
        )}

        {/* Tab bar */}
        <div className="flex gap-0 mb-5 bg-stone-200 rounded-xl p-1">
          {(['tasks', 'info', 'history'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg capitalize transition-all ${
                tab === t
                  ? 'bg-stone-50 text-leaf-700 shadow-sm'
                  : 'text-stone-400 hover:text-olive-500'
              }`}
            >
              {t === 'tasks' ? 'Tasks' : t === 'info' ? 'Care Info' : 'History'}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'tasks' && <PlantTasksTab plant={plant} />}
        {tab === 'info' && <CareInfoTab plant={plant} />}
        {tab === 'history' && <HistoryTab plantId={id} plant={plant} />}
      </main>

      {/* FAB for logging */}
      <AddLogSheet
        plantId={id}
        wateringIntervalDays={plant.watering_interval_days}
        mistingIntervalDays={plant.misting_interval_days}
        fertilizingIntervalDays={plant.fertilizing_interval_days}
        trigger={
          <button className="fixed bottom-20 right-6 w-14 h-14 bg-leaf-500 text-stone-50 rounded-full flex items-center justify-center shadow-lg z-30 hover:bg-leaf-600 transition-colors active:scale-95">
            <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
          </button>
        }
      />
    </div>
  )
}
