'use client'

import { useState, useMemo } from 'react'
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
  Leaf, Pencil,
} from 'lucide-react'
import { toast } from 'sonner'
import { usePlant, useArchivePlant, useDeletePlant, useUpdatePlant } from '@/lib/hooks/use-plants'
import { useSiteLocations } from '@/lib/hooks/use-locations'
import { useLogs, useCreateLog } from '@/lib/hooks/use-logs'
import { PlantStatusBadge } from '@/components/plants/plant-status-badge'
import { AddLogSheet } from '@/components/logs/add-log-sheet'
import { LogItem } from '@/components/logs/log-item'
import { Skeleton } from '@/components/ui/skeleton'
import { computeSmartWateringInterval, computeSmartFertilizingInterval, computeSmartMistingInterval } from '@/lib/utils/smart-interval'
import type { Plant, PlantStatus } from '@/lib/types'

// ─── care stat carousel ───────────────────────────────────────────────────────

function relativeLabel(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return formatDistanceToNow(parseISO(dateStr), { addSuffix: true })
}

function nextLabel(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = parseISO(dateStr)
  if (isPast(d) && !isToday(d)) return 'Overdue'
  if (isToday(d)) return 'Today'
  return `In ${differenceInCalendarDays(d, startOfToday())}d`
}

function CareStatCard({
  icon: Icon,
  label,
  last,
  next,
  accent,
  overdue,
  onLastChange,
}: {
  icon: React.ElementType
  label: string
  last: string | null | undefined
  next: string | null | undefined
  accent: string
  overdue: boolean
  onLastChange?: (date: string) => void
}) {
  const [editingDate, setEditingDate] = useState(false)

  return (
    <div
      className={`flex-shrink-0 w-40 bg-stone-100 rounded-xl p-3.5 border ${overdue ? 'border-clay-400/40' : 'border-stone-300'}`}
      style={{ boxShadow: '0 2px 12px -2px rgba(0,0,0,0.06)' }}
    >
      <div className={`w-7 h-7 rounded-full flex items-center justify-center mb-2 ${accent}`}>
        <Icon size={15} />
      </div>
      <p className="text-[9px] text-stone-500 uppercase tracking-widest font-medium mb-1">{label}</p>

      {editingDate && onLastChange ? (
        <input
          type="date"
          defaultValue={last ?? format(new Date(), 'yyyy-MM-dd')}
          max={format(new Date(), 'yyyy-MM-dd')}
          autoFocus
          onChange={(e) => {
            if (e.target.value) {
              onLastChange(e.target.value)
              setEditingDate(false)
            }
          }}
          onBlur={() => setEditingDate(false)}
          className="w-full text-xs text-leaf-700 bg-stone-50 border border-leaf-400 rounded px-1.5 py-0.5 outline-none mb-1"
        />
      ) : (
        <p className="text-xs text-stone-500 mb-0.5">
          Last:{' '}
          <span
            className={`text-leaf-700 font-medium ${onLastChange ? 'cursor-pointer underline decoration-dotted underline-offset-2' : ''}`}
            onClick={() => onLastChange && setEditingDate(true)}
          >
            {relativeLabel(last)}
          </span>
        </p>
      )}

      <p className={`text-xs ${overdue ? 'text-clay-500 font-semibold' : 'text-stone-500'}`}>
        Next: <span className="font-medium">{nextLabel(next)}</span>
      </p>
    </div>
  )
}

// ─── status switcher ──────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: PlantStatus; label: string; active: string }[] = [
  { value: 'healthy',         label: 'Healthy',    active: 'bg-leaf-500 text-white border-leaf-600' },
  { value: 'recovering',      label: 'Recovering', active: 'bg-amber-500 text-white border-amber-600' },
  { value: 'needs_attention', label: 'Attention',  active: 'bg-clay-400 text-white border-clay-500' },
]

function StatusSwitcher({ status, onChange, saving }: {
  status: PlantStatus
  onChange: (s: PlantStatus) => void
  saving: boolean
}) {
  return (
    <div className="flex gap-2 mb-4">
      {STATUS_OPTIONS.map(({ value, label, active }) => (
        <button
          key={value}
          onClick={() => onChange(value)}
          disabled={saving || status === value}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-all disabled:cursor-default ${
            status === value ? active : 'bg-stone-100 border-stone-300 text-stone-400 hover:border-stone-400'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// ─── pot info card ────────────────────────────────────────────────────────────

const POT_TYPES = ['plastic', 'terracotta', 'stoneware', 'glass', 'tray', 'other'] as const
type PotType = typeof POT_TYPES[number]
const POT_LABELS: Record<PotType, string> = {
  plastic: 'Plastic',
  terracotta: 'Terracotta',
  stoneware: 'Ceramic',
  glass: 'Glass',
  tray: 'Tray',
  other: 'Other',
}

type PotUpdates = Partial<Pick<Plant, 'pot_type' | 'pot_diameter_cm' | 'has_drainage' | 'last_repotted_at'>>

function PotInfoCard({ plant, onSave, saving }: {
  plant: Plant
  onSave: (updates: PotUpdates) => void
  saving: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [potType, setPotType] = useState<string | null>(plant.pot_type)
  const [diameter, setDiameter] = useState(plant.pot_diameter_cm?.toString() ?? '')
  const [hasDrainage, setHasDrainage] = useState<boolean | null>(plant.has_drainage ?? null)
  const [repottedAt, setRepottedAt] = useState(plant.last_repotted_at ?? '')

  function startEdit() {
    setPotType(plant.pot_type)
    setDiameter(plant.pot_diameter_cm?.toString() ?? '')
    setHasDrainage(plant.has_drainage ?? null)
    setRepottedAt(plant.last_repotted_at ?? '')
    setEditing(true)
  }

  function handleSave() {
    onSave({
      pot_type: potType,
      pot_diameter_cm: diameter ? Number(diameter) : null,
      has_drainage: hasDrainage,
      last_repotted_at: repottedAt || null,
    })
    setEditing(false)
  }

  const hasAnyData = plant.pot_type || plant.pot_diameter_cm || plant.has_drainage !== null || plant.last_repotted_at

  return (
    <div className="mt-4 bg-stone-100 rounded-xl border border-stone-300 px-4" style={{ boxShadow: '0 2px 12px -2px rgba(0,0,0,0.06)' }}>
      <div className="flex items-center justify-between py-3 border-b border-stone-200">
        <p className="text-[10px] font-semibold text-stone-500 uppercase tracking-widest">Pot & repotting</p>
        {editing ? (
          <div className="flex gap-3">
            <button onClick={() => setEditing(false)} className="text-xs text-stone-400 hover:text-stone-600">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="text-xs font-semibold text-leaf-600 hover:text-leaf-700 disabled:opacity-50">Save</button>
          </div>
        ) : (
          <button onClick={startEdit} className="text-stone-400 hover:text-leaf-600 transition-colors p-1 -mr-1">
            <Pencil size={14} />
          </button>
        )}
      </div>

      {editing ? (
        <div className="py-4 space-y-4">
          <div>
            <p className="text-[10px] text-stone-400 uppercase tracking-wide font-medium mb-2">Pot type</p>
            <div className="flex flex-wrap gap-1.5">
              {POT_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setPotType(potType === t ? null : t)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    potType === t ? 'bg-leaf-500/10 border-leaf-400 text-leaf-700' : 'bg-stone-50 border-stone-300 text-stone-500'
                  }`}
                >
                  {POT_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] text-stone-400 uppercase tracking-wide font-medium mb-1.5">Diameter (cm)</p>
            <input
              type="number"
              value={diameter}
              onChange={(e) => setDiameter(e.target.value)}
              min={1}
              max={100}
              placeholder="e.g. 15"
              className="w-full text-sm rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-leaf-700 outline-none focus:border-leaf-400"
            />
          </div>

          <div>
            <p className="text-[10px] text-stone-400 uppercase tracking-wide font-medium mb-2">Drainage hole</p>
            <div className="flex gap-2">
              {([{ v: true, l: 'Yes' }, { v: false, l: 'No' }] as const).map(({ v, l }) => (
                <button
                  key={l}
                  onClick={() => setHasDrainage(hasDrainage === v ? null : v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    hasDrainage === v ? 'bg-leaf-500/10 border-leaf-400 text-leaf-700' : 'bg-stone-50 border-stone-300 text-stone-500'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] text-stone-400 uppercase tracking-wide font-medium mb-1.5">Last repotted</p>
            <input
              type="date"
              value={repottedAt}
              onChange={(e) => setRepottedAt(e.target.value)}
              max={format(new Date(), 'yyyy-MM-dd')}
              className="w-full text-sm rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-leaf-700 outline-none focus:border-leaf-400"
            />
          </div>
        </div>
      ) : (
        <div className="py-3 space-y-2.5">
          {plant.pot_type && (
            <div className="flex justify-between items-center">
              <p className="text-xs text-stone-500">Pot type</p>
              <p className="text-xs font-medium text-leaf-700">{POT_LABELS[plant.pot_type as PotType] ?? plant.pot_type}</p>
            </div>
          )}
          {plant.pot_diameter_cm && (
            <div className="flex justify-between items-center">
              <p className="text-xs text-stone-500">Diameter</p>
              <p className="text-xs font-medium text-leaf-700">{plant.pot_diameter_cm} cm</p>
            </div>
          )}
          {plant.has_drainage !== null && plant.has_drainage !== undefined && (
            <div className="flex justify-between items-center">
              <p className="text-xs text-stone-500">Drainage</p>
              <p className="text-xs font-medium text-leaf-700">{plant.has_drainage ? 'Has drainage hole' : 'No drainage hole'}</p>
            </div>
          )}
          {plant.last_repotted_at && (
            <div className="flex justify-between items-center">
              <p className="text-xs text-stone-500">Last repotted</p>
              <p className="text-xs font-medium text-leaf-700">{format(parseISO(plant.last_repotted_at), 'MMM d, yyyy')}</p>
            </div>
          )}
          {!hasAnyData && (
            <p className="text-xs text-stone-400 italic py-1">Tap the pencil to add pot details</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── plant tasks tab ──────────────────────────────────────────────────────────

function PlantTasksTab({ plant }: { plant: Plant }) {
  const createLog = useCreateLog()
  const today = format(new Date(), 'yyyy-MM-dd')

  const allTasks = [
    { type: 'watering' as const, label: 'Water', icon: Droplets, dueDate: plant.next_watered_at, color: 'text-leaf-500' },
    { type: 'misting' as const, label: 'Mist', icon: Wind, dueDate: plant.next_misted_at, color: 'text-sky-500' },
    { type: 'fertilizing' as const, label: 'Fertilize', icon: Sprout, dueDate: plant.next_fertilized_at, color: 'text-olive-500' },
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

function CareInfoTab({ plant, onStatusChange, onPotSave, updating }: {
  plant: Plant
  onStatusChange: (status: PlantStatus) => void
  onPotSave: (updates: PotUpdates) => void
  updating: boolean
}) {
  const hasData = plant.light_requirement || plant.humidity_preference || plant.soil_type || plant.temperature_min || plant.watering_interval_days

  return (
    <div>
      {/* Status switcher */}
      <StatusSwitcher status={plant.status} onChange={onStatusChange} saving={updating} />

      {/* Care info card — read-only, loader while recalculating */}
      <div className="relative">
        {updating && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-stone-50/70 rounded-xl">
            <div className="w-6 h-6 rounded-full border-2 border-leaf-400 border-t-transparent animate-spin" />
          </div>
        )}
        {hasData ? (
          <div className="bg-stone-100 rounded-xl border border-stone-300 px-4" style={{ boxShadow: '0 2px 12px -2px rgba(0,0,0,0.06)' }}>
            {plant.watering_interval_days && (
              <InfoRow icon={Droplets} label="Watering" value={`Every ${plant.watering_interval_days} days`} accent="bg-leaf-500/10 text-leaf-500" />
            )}
            {plant.misting_interval_days && (
              <InfoRow icon={Wind} label="Misting" value={`Every ${plant.misting_interval_days} days`} accent="bg-sky-100 text-sky-500" />
            )}
            {plant.fertilizing_interval_days && (
              <InfoRow icon={Sprout} label="Fertilizing" value={`Every ${plant.fertilizing_interval_days} days`} accent="bg-olive-400/10 text-olive-500" />
            )}
            {plant.light_requirement && (
              <InfoRow icon={Sun} label="Light" value={LIGHT_LABELS[plant.light_requirement] ?? plant.light_requirement} accent="bg-amber-100 text-amber-500" />
            )}
            {plant.humidity_preference && (
              <InfoRow icon={Wind} label="Humidity" value={HUMIDITY_LABELS[plant.humidity_preference] ?? plant.humidity_preference} accent="bg-sky-100 text-sky-500" />
            )}
            {plant.soil_type && (
              <InfoRow icon={Leaf} label="Soil" value={plant.soil_type} accent="bg-stone-300 text-stone-600" />
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
        ) : (
          <div className="py-8 text-center bg-stone-100 rounded-xl border border-stone-300 px-4">
            <p className="text-stone-400 text-sm mb-1">No care profile detected yet.</p>
            <p className="text-xs text-stone-400">
              {plant.species ? 'Edit the plant to re-trigger species lookup.' : 'Add a species name to auto-detect care requirements.'}
            </p>
          </div>
        )}
      </div>

      {/* Pot info card */}
      <PotInfoCard plant={plant} onSave={onPotSave} saving={updating} />
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
  const updatePlant = useUpdatePlant(id)
  const archivePlant = useArchivePlant()
  const deletePlant = useDeletePlant()
  const { data: siteLocations } = useSiteLocations()

  const locationMap = useMemo(
    () => new Map((siteLocations ?? []).map((l) => [l.name, l])),
    [siteLocations],
  )

  // ─ watering date edit ─────────────────────────────────────────────────────
  async function handleLastWateringChange(date: string) {
    if (!plant) return
    const loc = locationMap.get(plant.location ?? '')
    const smartInterval = computeSmartWateringInterval(plant, loc?.geo_lat ?? null)
    const interval = smartInterval ?? plant.watering_interval_days
    try {
      await updatePlant.mutateAsync({
        last_watered_at: date,
        next_check_soil_at: null,
        ...(interval ? { next_watered_at: format(addDays(parseISO(date), interval), 'yyyy-MM-dd') } : {}),
      })
      toast.success('Watering date updated')
    } catch { toast.error('Failed to update') }
  }

  async function handleLastFertilizingChange(date: string) {
    if (!plant) return
    const loc = locationMap.get(plant.location ?? '')
    const fertResult = computeSmartFertilizingInterval(plant, loc?.geo_lat ?? null)
    const interval = fertResult && !fertResult.suspended ? fertResult.days : plant.fertilizing_interval_days
    try {
      await updatePlant.mutateAsync({
        last_fertilized_at: date,
        ...(interval ? { next_fertilized_at: format(addDays(parseISO(date), interval), 'yyyy-MM-dd') } : {}),
      })
      toast.success('Fertilizing date updated')
    } catch { toast.error('Failed to update') }
  }

  // ─ status change ──────────────────────────────────────────────────────────
  async function handleStatusChange(status: PlantStatus) {
    try {
      await updatePlant.mutateAsync({ status })
    } catch { toast.error('Failed to update status') }
  }

  // ─ pot info save + interval recalculation ─────────────────────────────────
  async function handlePotSave(updates: PotUpdates) {
    if (!plant) return
    const updatedPlant = { ...plant, ...updates }
    const loc = locationMap.get(plant.location ?? '')
    const geoLat = loc?.geo_lat ?? null
    const locationHumidity = loc?.humidity ?? null
    const locationLightLevel = loc?.light_level ?? null

    const smartWatering = computeSmartWateringInterval(updatedPlant, geoLat)
    const fertResult = computeSmartFertilizingInterval(updatedPlant, geoLat)
    const smartFert = fertResult && !fertResult.suspended ? fertResult.days : null
    const smartMisting = computeSmartMistingInterval(updatedPlant, locationHumidity, locationLightLevel)

    const payload: Partial<Plant> = {
      ...updates,
      misting_interval_days: smartMisting,
      misting_source: smartMisting ? 'formula' : null,
      next_misted_at: smartMisting
        ? format(addDays(plant.last_misted_at ? parseISO(plant.last_misted_at) : new Date(), smartMisting), 'yyyy-MM-dd')
        : null,
    }
    if (smartWatering) {
      payload.watering_interval_days = smartWatering
      if (plant.last_watered_at) {
        payload.next_watered_at = format(addDays(parseISO(plant.last_watered_at), smartWatering), 'yyyy-MM-dd')
      }
    }
    if (smartFert) {
      payload.fertilizing_interval_days = smartFert
      if (plant.last_fertilized_at) {
        payload.next_fertilized_at = format(addDays(parseISO(plant.last_fertilized_at), smartFert), 'yyyy-MM-dd')
      }
    }

    try {
      await updatePlant.mutateAsync(payload)
      toast.success('Pot info saved')
    } catch { toast.error('Failed to save') }
  }

  // ─ archive / delete ───────────────────────────────────────────────────────
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

      {/* Hero */}
      <div className="w-full aspect-video bg-stone-200 relative">
        {plant.photo_url ? (
          <Image src={plant.photo_url} alt={plant.name} fill className="object-cover" priority sizes="512px" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-6xl">🪴</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-stone-900/60 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
          <div className="flex items-end justify-between">
            <div className="flex-1 min-w-0 mr-3">
              <h1 className="text-2xl font-semibold text-white leading-tight truncate">
                {plant.nickname ?? plant.name}
              </h1>
              {plant.species && <p className="text-white/70 text-sm italic truncate">{plant.species}</p>}
            </div>
            <PlantStatusBadge status={plant.status} />
          </div>
        </div>
      </div>

      <main className="px-4 pt-4">
        {/* Meta row */}
        {(plant.location || plant.acquisition_date) && (
          <div className="flex flex-wrap gap-3 text-xs text-stone-500 mb-4">
            {plant.location && <div className="flex items-center gap-1"><MapPin size={12} /> {plant.location}</div>}
            {plant.acquisition_date && <div className="flex items-center gap-1"><Calendar size={12} /> Since {format(parseISO(plant.acquisition_date), 'MMM yyyy')}</div>}
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
            onLastChange={handleLastWateringChange}
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
            onLastChange={handleLastFertilizingChange}
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
                tab === t ? 'bg-stone-50 text-leaf-700 shadow-sm' : 'text-stone-400 hover:text-olive-500'
              }`}
            >
              {t === 'tasks' ? 'Tasks' : t === 'info' ? 'Care Info' : 'History'}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'tasks' && <PlantTasksTab plant={plant} />}
        {tab === 'info' && (
          <CareInfoTab
            plant={plant}
            onStatusChange={handleStatusChange}
            onPotSave={handlePotSave}
            updating={updatePlant.isPending}
          />
        )}
        {tab === 'history' && <HistoryTab plantId={id} plant={plant} />}
      </main>

      {/* FAB */}
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
