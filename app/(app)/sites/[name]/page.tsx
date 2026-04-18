'use client'

import { useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowLeft,
  Camera,
  Droplets,
  FileText,
  MapPin,
  Pencil,
  Sun,
  X,
} from 'lucide-react'
import { isPast, parseISO } from 'date-fns'
import { toast } from 'sonner'
import { usePlants } from '@/lib/hooks/use-plants'
import { useSiteLocation, useUpsertLocation } from '@/lib/hooks/use-locations'
import { usePhotoUpload } from '@/lib/hooks/use-photo-upload'
import { PlantStatusBadge } from '@/components/plants/plant-status-badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { LocationType } from '@/lib/types'

// ─── constants ───────────────────────────────────────────────────────────────

const LOCATION_TYPE_OPTIONS = [
  { value: 'indoor_home',    label: 'Indoor home',    emoji: '🏠' },
  { value: 'greenhouse',     label: 'Greenhouse',     emoji: '🌡️' },
  { value: 'outdoor_garden', label: 'Garden',         emoji: '🌳' },
  { value: 'balcony_patio',  label: 'Balcony / patio', emoji: '🏡' },
  { value: 'office',         label: 'Office',         emoji: '💼' },
  { value: 'other',          label: 'Other',          emoji: '📍' },
] as const

const LIGHT_OPTIONS = [
  { value: 'low', label: 'Low', emoji: '🌑' },
  { value: 'medium', label: 'Medium', emoji: '🌤' },
  { value: 'bright_indirect', label: 'Bright indirect', emoji: '⛅' },
  { value: 'direct', label: 'Full sun', emoji: '☀️' },
] as const

const HUMIDITY_OPTIONS = [
  { value: 'low', label: 'Low', sub: 'cactus-friendly' },
  { value: 'medium', label: 'Medium', sub: 'typical home' },
  { value: 'high', label: 'High', sub: 'tropical' },
] as const

// ─── page ─────────────────────────────────────────────────────────────────────

interface Draft {
  locationType: LocationType | null
  lightLevel: string | null
  humidity: string | null
  notes: string
}

export default function SiteDetailPage() {
  const params = useParams<{ name: string }>()
  // Next.js App Router URL-decodes dynamic segments automatically
  const siteName = params.name

  const router = useRouter()
  const { data: plants } = usePlants()
  const { data: location, isLoading: locationLoading } = useSiteLocation(siteName)
  const upsert = useUpsertLocation()
  const { uploadPhoto, uploading } = usePhotoUpload()

  // editing: whether the environment form is open
  // draft: snapshot of editable fields (null when not editing)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)

  const photoInputRef = useRef<HTMLInputElement>(null)

  const sitePlants = (plants ?? []).filter((p) => p.location === siteName)
  const photos = location?.photo_urls ?? []

  function startEdit() {
    setDraft({
      locationType: location?.location_type ?? null,
      lightLevel: location?.light_level ?? null,
      humidity: location?.humidity ?? null,
      notes: location?.notes ?? '',
    })
    setEditing(true)
  }

  async function handleSave() {
    if (!draft) return
    try {
      await upsert.mutateAsync({
        name: siteName,
        location_type: draft.locationType,
        light_level: draft.lightLevel,
        humidity: draft.humidity,
        notes: draft.notes.trim() || null,
        photo_urls: location?.photo_urls ?? [],
      })
      setDraft(null)
      setEditing(false)
      toast.success('Settings saved')
    } catch {
      toast.error('Failed to save')
    }
  }

  async function handleAddPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    try {
      const url = await uploadPhoto(file, 'locations')
      await upsert.mutateAsync({
        name: siteName,
        photo_urls: [...photos, url],
        location_type: location?.location_type ?? null,
        light_level: location?.light_level ?? null,
        humidity: location?.humidity ?? null,
        notes: location?.notes ?? null,
      })
      toast.success('Photo added')
    } catch {
      toast.error('Failed to upload photo')
    }
  }

  async function handleDeletePhoto(url: string) {
    if (!confirm('Remove this photo?')) return
    try {
      await upsert.mutateAsync({
        name: siteName,
        photo_urls: photos.filter((u) => u !== url),
        location_type: location?.location_type ?? null,
        light_level: location?.light_level ?? null,
        humidity: location?.humidity ?? null,
        notes: location?.notes ?? null,
      })
      toast.success('Photo removed')
    } catch {
      toast.error('Failed to remove photo')
    }
  }

  const overdueCount = sitePlants.filter(
    (p) => p.next_watered_at && isPast(parseISO(p.next_watered_at))
  ).length

  return (
    <div className="min-h-screen bg-stone-50 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-stone-50/80 backdrop-blur-md px-4 pt-5 pb-4 flex items-center gap-3 border-b border-stone-200/60">
        <button
          onClick={() => router.back()}
          className="p-2 -ml-2 rounded-full hover:bg-stone-200 transition-colors text-leaf-700"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-leaf-700 truncate">{siteName}</h1>
          <p className="text-xs text-olive-500">
            {sitePlants.length} {sitePlants.length === 1 ? 'plant' : 'plants'}
            {overdueCount > 0 && (
              <span className="ml-1.5 text-clay-500 font-medium">· {overdueCount} overdue</span>
            )}
          </p>
        </div>
        {editing ? (
          <button
            onClick={handleSave}
            disabled={upsert.isPending}
            className="px-3 py-1.5 bg-leaf-500 text-stone-50 text-sm font-semibold rounded-lg hover:bg-leaf-600 disabled:opacity-50 transition-colors"
          >
            {upsert.isPending ? 'Saving…' : 'Save'}
          </button>
        ) : (
          <button
            onClick={startEdit}
            className="px-3 py-1.5 text-sm font-medium text-leaf-600 border border-leaf-400/30 rounded-lg hover:bg-leaf-500/10 transition-colors flex items-center gap-1.5"
          >
            <Pencil size={13} /> Edit
          </button>
        )}
      </header>

      <main className="px-4 pt-5 space-y-6">
        {/* ── Photos ─────────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-widest mb-3">
            Location photos
          </h2>
          <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1 -mx-4 px-4">
            {locationLoading ? (
              <>
                <Skeleton className="w-28 h-28 rounded-xl flex-shrink-0" />
                <Skeleton className="w-28 h-28 rounded-xl flex-shrink-0" />
              </>
            ) : (
              photos.map((url) => (
                <div key={url} className="relative flex-shrink-0 w-28 h-28">
                  <Image
                    src={url}
                    alt="Location photo"
                    fill
                    className="object-cover rounded-xl"
                    sizes="112px"
                  />
                  <button
                    onClick={() => handleDeletePhoto(url)}
                    className="absolute top-1 right-1 w-5 h-5 bg-stone-900/70 rounded-full flex items-center justify-center text-white hover:bg-red-500 transition-colors"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))
            )}
            <button
              onClick={() => photoInputRef.current?.click()}
              disabled={uploading}
              className="flex-shrink-0 w-28 h-28 rounded-xl border-2 border-dashed border-stone-300 flex flex-col items-center justify-center gap-1.5 text-stone-400 hover:border-leaf-400 hover:text-leaf-500 transition-colors disabled:opacity-50"
            >
              {uploading ? (
                <div className="w-5 h-5 rounded-full border-2 border-leaf-400 border-t-transparent animate-spin" />
              ) : (
                <>
                  <Camera size={20} />
                  <span className="text-[10px] font-medium">Add photo</span>
                </>
              )}
            </button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAddPhoto}
            />
          </div>
        </section>

        {/* ── Environment ─────────────────────────────────────────────────── */}
        <section
          className="bg-stone-100 rounded-xl border border-stone-300 p-4 space-y-5"
          style={{ boxShadow: '0 2px 12px -2px rgba(0,0,0,0.06)' }}
        >
          <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-widest">
            Environment
          </h2>

          {/* Location type */}
          <div>
            <p className="text-xs text-stone-500 mb-2 flex items-center gap-1.5">
              <MapPin size={12} className="text-leaf-500" /> Location type
            </p>
            {editing && draft ? (
              <div className="flex flex-wrap gap-2">
                {LOCATION_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() =>
                      setDraft((d) => d && { ...d, locationType: d.locationType === opt.value ? null : opt.value })
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      draft.locationType === opt.value
                        ? 'bg-leaf-500/10 border-leaf-400 text-leaf-700'
                        : 'bg-stone-50 border-stone-300 text-stone-500 hover:border-leaf-300'
                    }`}
                  >
                    {opt.emoji} {opt.label}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-leaf-700">
                {location?.location_type ? (
                  (() => {
                    const opt = LOCATION_TYPE_OPTIONS.find((o) => o.value === location.location_type)
                    return opt ? `${opt.emoji} ${opt.label}` : location.location_type
                  })()
                ) : (
                  <span className="text-stone-400 italic">Not set</span>
                )}
              </p>
            )}
          </div>

          {/* Light */}
          <div>
            <p className="text-xs text-stone-500 mb-2 flex items-center gap-1.5">
              <Sun size={12} className="text-amber-500" /> Light level
            </p>
            {editing && draft ? (
              <div className="flex flex-wrap gap-2">
                {LIGHT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() =>
                      setDraft((d) => d && { ...d, lightLevel: d.lightLevel === opt.value ? null : opt.value })
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      draft.lightLevel === opt.value
                        ? 'bg-amber-100 border-amber-400 text-amber-700'
                        : 'bg-stone-50 border-stone-300 text-stone-500 hover:border-amber-300'
                    }`}
                  >
                    {opt.emoji} {opt.label}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-leaf-700">
                {location?.light_level ? (
                  (() => {
                    const opt = LIGHT_OPTIONS.find((o) => o.value === location.light_level)
                    return opt ? `${opt.emoji} ${opt.label}` : location.light_level
                  })()
                ) : (
                  <span className="text-stone-400 italic">Not set</span>
                )}
              </p>
            )}
          </div>

          {/* Humidity */}
          <div>
            <p className="text-xs text-stone-500 mb-2 flex items-center gap-1.5">
              <Droplets size={12} className="text-sky-500" /> Humidity
            </p>
            {editing && draft ? (
              <div className="flex flex-wrap gap-2">
                {HUMIDITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() =>
                      setDraft((d) => d && { ...d, humidity: d.humidity === opt.value ? null : opt.value })
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      draft.humidity === opt.value
                        ? 'bg-sky-100 border-sky-400 text-sky-700'
                        : 'bg-stone-50 border-stone-300 text-stone-500 hover:border-sky-300'
                    }`}
                  >
                    {opt.label}
                    <span className="text-[10px] ml-1 opacity-60">{opt.sub}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-leaf-700">
                {location?.humidity ? (
                  (() => {
                    const opt = HUMIDITY_OPTIONS.find((o) => o.value === location.humidity)
                    return opt ? `${opt.label} humidity (${opt.sub})` : location.humidity
                  })()
                ) : (
                  <span className="text-stone-400 italic">Not set</span>
                )}
              </p>
            )}
          </div>

          {/* Notes */}
          <div>
            <p className="text-xs text-stone-500 mb-2 flex items-center gap-1.5">
              <FileText size={12} /> Notes
            </p>
            {editing && draft ? (
              <textarea
                value={draft.notes}
                onChange={(e) => setDraft((d) => d && { ...d, notes: e.target.value })}
                placeholder="Window faces south, near radiator…"
                rows={3}
                className="w-full text-sm rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-leaf-700 placeholder:text-stone-400 focus:outline-none focus:border-leaf-400 resize-none"
              />
            ) : (
              <p className="text-sm text-leaf-700 whitespace-pre-wrap">
                {location?.notes || <span className="text-stone-400 italic">No notes</span>}
              </p>
            )}
          </div>
        </section>

        {/* ── Plants ──────────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-widest mb-3">
            Plants here
          </h2>
          {sitePlants.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm text-stone-400">No plants at this location yet.</p>
              <p className="text-xs text-stone-400 mt-1">
                Assign a plant to &quot;{siteName}&quot; when adding or editing it.
              </p>
            </div>
          ) : (
            <div
              className="bg-stone-100 rounded-xl border border-stone-300 overflow-hidden"
              style={{ boxShadow: '0 2px 12px -2px rgba(0,0,0,0.06)' }}
            >
              {sitePlants.map((plant) => {
                const needsWater =
                  plant.next_watered_at && isPast(parseISO(plant.next_watered_at))
                return (
                  <Link
                    key={plant.id}
                    href={`/plants/${plant.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-stone-200/60 transition-colors border-b border-stone-200/60 last:border-0"
                  >
                    <div className="w-10 h-10 rounded-lg bg-stone-200 overflow-hidden relative flex-shrink-0">
                      {plant.photo_url ? (
                        <Image
                          src={plant.photo_url}
                          alt={plant.name}
                          fill
                          className="object-cover"
                          sizes="40px"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-lg">
                          🪴
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-leaf-700 truncate">
                        {plant.nickname ?? plant.name}
                      </p>
                      {plant.species && (
                        <p className="text-[10px] text-olive-500 italic truncate">
                          {plant.species}
                        </p>
                      )}
                      {needsWater && (
                        <p className="text-[10px] font-semibold text-clay-500 mt-0.5">
                          Needs water
                        </p>
                      )}
                    </div>
                    <PlantStatusBadge status={plant.status} />
                  </Link>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
