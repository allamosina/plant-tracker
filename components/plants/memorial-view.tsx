'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { format, parseISO } from 'date-fns'
import { ArchiveRestore, MapPin, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useLogs } from '@/lib/hooks/use-logs'
import { useDeletePlant, useRestorePlant } from '@/lib/hooks/use-plants'
import { GoodbyeSheet } from '@/components/plants/goodbye-sheet'
import { LogItem } from '@/components/logs/log-item'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DEPARTURE_REASONS, departurePath, displayName, lifeSpanLabel, timeTogetherLabel,
} from '@/lib/departure'
import type { LogType, Plant } from '@/lib/types'

const STAT_LABELS: Partial<Record<LogType, [string, string]>> = {
  watering: ['watered it', 'time'],
  misting: ['misted it', 'time'],
  fertilizing: ['fed it', 'time'],
  repotting: ['repotted it', 'time'],
  pruning: ['pruned it', 'time'],
}

function TimeTogether({ plantId }: { plantId: string }) {
  const { data: logs, isLoading } = useLogs(plantId)

  if (isLoading) return <Skeleton className="h-24 rounded-xl" />
  if (!logs?.length) return null

  const counts = new Map<LogType, number>()
  for (const log of logs) counts.set(log.type, (counts.get(log.type) ?? 0) + 1)
  const stats = (Object.keys(STAT_LABELS) as LogType[])
    .filter((t) => counts.get(t))
    .map((t) => {
      const n = counts.get(t)!
      const [verb, unit] = STAT_LABELS[t]!
      return `You ${verb} ${n} ${n === 1 ? unit : unit + 's'}`
    })
  const photos = logs.filter((l) => l.photo_url)

  return (
    <div className="space-y-6">
      {stats.length > 0 && (
        <section>
          <h2 className="label-caps text-olive-500 mb-2">Your time together</h2>
          <ul className="bg-stone-100 rounded-xl border border-stone-300 p-4 space-y-1.5 text-sm text-leaf-700">
            {stats.map((s) => <li key={s}>{s}</li>)}
          </ul>
        </section>
      )}

      {photos.length > 0 && (
        <section>
          <h2 className="label-caps text-olive-500 mb-2">Moments</h2>
          <div className="grid grid-cols-3 gap-2">
            {photos.map((log) => (
              <div key={log.id} className="relative aspect-square rounded-lg overflow-hidden bg-stone-200">
                <Image src={log.photo_url!} alt={format(parseISO(log.date), 'MMM d, yyyy')} fill className="object-cover" sizes="160px" />
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="label-caps text-olive-500 mb-3">History</h2>
        <div className="relative pl-4 border-l border-stone-300 ml-4 space-y-0">
          {logs.map((log) => <LogItem key={log.id} log={log} />)}
        </div>
      </section>
    </div>
  )
}

/** Read-only page for a plant that left the collection (Plant Heaven / Rehomed). */
export function MemorialView({ plant }: { plant: Plant }) {
  const router = useRouter()
  const restore = useRestorePlant()
  const deletePlant = useDeletePlant()
  const [showMenu, setShowMenu] = useState(false)
  const [editing, setEditing] = useState(false)

  const name = displayName(plant)
  const reason = plant.departure_reason ? DEPARTURE_REASONS[plant.departure_reason] : null
  const isHeaven = plant.departure_reason === 'passed_away'

  async function handleRestore() {
    if (!confirm(`Bring ${name} back to your collection?`)) return
    try {
      await restore.mutateAsync(plant)
      toast.success(`${name} is back home 🌱`)
    } catch { toast.error('Failed to bring it back') }
  }

  async function handleForget() {
    if (!confirm(`Forget ${name} forever? Its photos, notes and history will be deleted.`)) return
    if (!confirm('This cannot be undone. Delete for good?')) return
    try {
      await deletePlant.mutateAsync(plant.id)
      toast.success(`${name} was removed`)
      router.push(departurePath(plant))
    } catch { toast.error('Failed to delete') }
  }

  return (
    <div className={`min-h-screen pb-24 ${isHeaven ? 'bg-gradient-to-b from-[#DDE3EC] via-[#ECE6E4] to-stone-50' : 'bg-stone-50'}`}>
      <header className="absolute top-0 left-0 right-0 z-20 px-2 py-4 flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-full bg-stone-50/80 backdrop-blur-md text-leaf-700 hover:bg-stone-200 transition-colors"
          aria-label="Go back"
        >
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
        </button>

        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 rounded-full bg-stone-50/80 backdrop-blur-md text-leaf-700 hover:bg-stone-200 transition-colors"
            aria-label="More"
          >
            <MoreVertical size={20} />
          </button>
          {showMenu && (
            <div className="absolute right-0 mt-2 w-52 bg-stone-100 rounded-xl shadow-lg border border-stone-300 py-1 z-30">
              <button
                onClick={() => { setShowMenu(false); setEditing(true) }}
                className="w-full flex items-center px-4 py-3 text-sm text-leaf-700 hover:bg-stone-200 transition-colors"
              >
                <Pencil size={16} className="mr-2" /> Edit memory
              </button>
              <button
                onClick={() => { setShowMenu(false); handleRestore() }}
                className="w-full flex items-center px-4 py-3 text-sm text-leaf-700 hover:bg-stone-200 transition-colors"
              >
                <ArchiveRestore size={16} className="mr-2" /> Bring back to collection
              </button>
              <button
                onClick={() => { setShowMenu(false); handleForget() }}
                className="w-full flex items-center px-4 py-3 text-sm text-clay-400 hover:bg-clay-400/10 transition-colors"
              >
                <Trash2 size={16} className="mr-2" /> Forget forever
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Hero */}
      <div className="w-full aspect-video bg-stone-200 relative">
        {plant.photo_url ? (
          <Image
            src={plant.photo_url}
            alt={name}
            fill
            priority
            sizes="512px"
            className={`object-cover ${isHeaven ? 'sepia-[.3] saturate-75' : ''}`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-6xl">🪴</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-stone-900/60 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
          <h1 className="text-2xl font-semibold text-white leading-tight truncate">{name}</h1>
          {plant.species && <p className="text-white/70 text-sm italic truncate">{plant.species}</p>}
        </div>
      </div>

      <main className="px-4 pt-5 space-y-6">
        <div className="text-center space-y-1">
          <p className="text-sm text-olive-500">
            {reason ? `${reason.emoji} ${reason.label}` : 'Archived'} · {plant.archived_at && format(parseISO(plant.archived_at), 'MMM d, yyyy')}
          </p>
          <p className="text-leaf-700 font-medium">{lifeSpanLabel(plant)}</p>
          <p className="text-xs text-stone-500">With you for {timeTogetherLabel(plant)}</p>
          {plant.departure_place && (
            <p className="text-xs text-stone-500 inline-flex items-center gap-1 justify-center">
              <MapPin size={12} /> {plant.departure_place}
            </p>
          )}
        </div>

        {plant.departure_note && (
          <blockquote className="bg-white/50 rounded-xl border border-stone-300 p-4 text-sm text-olive-500 italic whitespace-pre-wrap text-center">
            {plant.departure_note}
          </blockquote>
        )}

        {!reason && (
          <button
            onClick={() => setEditing(true)}
            className="w-full py-3 rounded-xl border border-dashed border-stone-400 text-sm text-leaf-700 hover:bg-stone-100 transition-colors"
          >
            What happened to {name}?
          </button>
        )}

        <TimeTogether plantId={plant.id} />
      </main>

      <GoodbyeSheet
        plant={plant}
        mode="edit"
        open={editing}
        onOpenChange={setEditing}
        onDone={() => toast.success('Memory saved')}
      />
    </div>
  )
}
