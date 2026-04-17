'use client'

import { useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Camera, ImageIcon, Timer, RefreshCw } from 'lucide-react'
import { format, addDays, parseISO } from 'date-fns'
import { useCreatePlant, useUpdatePlant, useLocations } from '@/lib/hooks/use-plants'
import { usePhotoUpload } from '@/lib/hooks/use-photo-upload'
import { lookupCareProfile } from '@/lib/actions/species-lookup'
import { identifyPlantFromPhoto } from '@/lib/actions/identify-plant'
import type { Plant, PlantStatus } from '@/lib/types'

/** Resize a File to ≤1024px longest side and return as base64 JPEG. */
async function resizeAndEncode(
  file: File,
): Promise<{ base64: string; mimeType: 'image/jpeg' }> {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img')
    const blobUrl = URL.createObjectURL(file)
    img.onload = () => {
      const maxDim = 512
      let { width, height } = img
      if (width > maxDim || height > maxDim) {
        if (width >= height) {
          height = Math.round((height * maxDim) / width)
          width = maxDim
        } else {
          width = Math.round((width * maxDim) / height)
          height = maxDim
        }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(blobUrl)
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error('canvas toBlob failed'))
          const reader = new FileReader()
          reader.onload = (ev) => {
            const dataUrl = ev.target!.result as string
            resolve({ base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' })
          }
          reader.onerror = reject
          reader.readAsDataURL(blob)
        },
        'image/jpeg',
        0.85,
      )
    }
    img.onerror = reject
    img.src = blobUrl
  })
}

// ─── pot types ───────────────────────────────────────────────────────────────

const POT_TYPES = ['plastic', 'terracotta', 'stoneware', 'glass', 'other'] as const
type PotType = typeof POT_TYPES[number]

const POT_LABELS: Record<PotType, string> = {
  plastic: 'Plastic',
  terracotta: 'Terracotta',
  stoneware: 'Stoneware',
  glass: 'Glass',
  other: 'Other',
}

// ─── schema ──────────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(1, 'Plant name is required'),
  nickname: z.string().optional(),
  species: z.string().optional(),
  location: z.string().optional(),
  acquisition_date: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['healthy', 'needs_attention', 'recovering'] as const),
  last_watered_at: z.string().optional(),
  last_misted_at: z.string().optional(),
  last_fertilized_at: z.string().optional(),
  last_repotted_at: z.string().optional(),
  pot_diameter_cm: z.string().optional(),
  pot_height_cm: z.string().optional(),
})

type FormData = z.infer<typeof schema>

const STATUS_OPTIONS: { value: PlantStatus; label: string }[] = [
  { value: 'healthy', label: 'Healthy' },
  { value: 'needs_attention', label: 'Needs Attention' },
  { value: 'recovering', label: 'Recovering' },
]

// ─── component ───────────────────────────────────────────────────────────────

export function PlantForm({ plant }: { plant?: Plant }) {
  const router = useRouter()
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  const [photoUrl, setPhotoUrl] = useState<string | null>(plant?.photo_url ?? null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [lookingUp, setLookingUp] = useState(false)
  const [identifying, setIdentifying] = useState(false)
  const [identifyFailed, setIdentifyFailed] = useState(false)
  const [potType, setPotType] = useState<PotType | null>((plant?.pot_type as PotType | null) ?? null)

  const createPlant = useCreatePlant()
  const updatePlant = useUpdatePlant(plant?.id ?? '')
  const { uploadPhoto, uploading } = usePhotoUpload()
  const { data: existingLocations = [] } = useLocations()

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: plant?.name ?? '',
      nickname: plant?.nickname ?? '',
      species: plant?.species ?? '',
      location: plant?.location ?? '',
      acquisition_date: plant?.acquisition_date ?? '',
      notes: plant?.notes ?? '',
      status: plant?.status ?? 'healthy',
      last_watered_at: plant?.last_watered_at ?? '',
      last_misted_at: plant?.last_misted_at ?? '',
      last_fertilized_at: plant?.last_fertilized_at ?? '',
      last_repotted_at: plant?.last_repotted_at ?? '',
      pot_diameter_cm: plant?.pot_diameter_cm?.toString() ?? '',
      pot_height_cm: plant?.pot_height_cm?.toString() ?? '',
    },
  })

  const status = watch('status')
  const speciesValue = watch('species')
  const locationValue = watch('location')

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setPhotoFile(file)
    setPhotoUrl(null)          // hide previous preview while identifying
    setIdentifyFailed(false)
    setIdentifying(true)

    let base64: string
    let mimeType: 'image/jpeg'

    try {
      const encoded = await resizeAndEncode(file)
      base64 = encoded.base64
      mimeType = encoded.mimeType
    } catch {
      // Resize failed — fall back to raw data URL, skip identification
      const reader = new FileReader()
      reader.onload = (ev) => setPhotoUrl(ev.target?.result as string)
      reader.readAsDataURL(file)
      setIdentifyFailed(true)
      setIdentifying(false)
      return
    }

    try {
      const result = await identifyPlantFromPhoto(base64, mimeType)
      // Show preview only after identification attempt
      setPhotoUrl(`data:image/jpeg;base64,${base64}`)
      if (result) {
        setValue('name', result.commonName)
        setValue('species', result.species)
      } else {
        setIdentifyFailed(true)
      }
    } catch {
      setPhotoUrl(`data:image/jpeg;base64,${base64}`)
      setIdentifyFailed(true)
    } finally {
      setIdentifying(false)
    }
  }

  function handleRemovePhoto() {
    setPhotoUrl(null)
    setPhotoFile(null)
    setIdentifyFailed(false)
  }

  async function onSubmit(data: FormData) {
    try {
      let finalPhotoUrl: string | null = plant?.photo_url ?? null
      if (photoFile) {
        finalPhotoUrl = await uploadPhoto(photoFile, 'plants')
      } else if (photoUrl && !photoUrl.startsWith('data:')) {
        // Already a remote URL — keep it
        finalPhotoUrl = photoUrl
      } else if (!photoUrl) {
        // User removed the photo
        finalPhotoUrl = null
      }

      // Species care profile lookup
      const speciesChanged = data.species !== (plant?.species ?? '')
      let wateringIntervalDays = plant?.watering_interval_days ?? null
      let wateringSource = plant?.watering_source ?? null
      let mistingIntervalDays = plant?.misting_interval_days ?? null
      let mistingSource = plant?.misting_source ?? null
      let fertilizingIntervalDays = plant?.fertilizing_interval_days ?? null
      let fertilizingSource = plant?.fertilizing_source ?? null
      let lightRequirement = plant?.light_requirement ?? null
      let humidityPreference = plant?.humidity_preference ?? null
      let soilType = plant?.soil_type ?? null
      let temperatureMin = plant?.temperature_min ?? null
      let temperatureMax = plant?.temperature_max ?? null

      if (data.species && (speciesChanged || !wateringIntervalDays)) {
        setLookingUp(true)
        const profile = await lookupCareProfile(data.species)
        setLookingUp(false)
        if (profile) {
          wateringIntervalDays = profile.wateringIntervalDays
          wateringSource = profile.wateringSource
          mistingIntervalDays = profile.mistingIntervalDays
          mistingSource = profile.mistingIntervalDays ? 'claude' : null
          fertilizingIntervalDays = profile.fertilizingIntervalDays
          fertilizingSource = profile.fertilizingIntervalDays ? 'claude' : null
          lightRequirement = profile.lightRequirement
          humidityPreference = profile.humidityPreference
          soilType = profile.soilType
          temperatureMin = profile.temperatureMin
          temperatureMax = profile.temperatureMax
        }
      }

      // Compute next_watered_at
      let nextWateredAt: string | null = plant?.next_watered_at ?? null
      if (data.last_watered_at && wateringIntervalDays) {
        nextWateredAt = format(addDays(parseISO(data.last_watered_at), wateringIntervalDays), 'yyyy-MM-dd')
      }

      // Compute next_misted_at
      let nextMistedAt: string | null = plant?.next_misted_at ?? null
      if (data.last_misted_at && mistingIntervalDays) {
        nextMistedAt = format(addDays(parseISO(data.last_misted_at), mistingIntervalDays), 'yyyy-MM-dd')
      } else if (mistingIntervalDays && !nextMistedAt) {
        nextMistedAt = format(addDays(new Date(), mistingIntervalDays), 'yyyy-MM-dd')
      }

      // Compute next_fertilized_at (auto only — no manual entry)
      let nextFertilizedAt: string | null = plant?.next_fertilized_at ?? null
      if (data.last_fertilized_at && fertilizingIntervalDays) {
        nextFertilizedAt = format(addDays(parseISO(data.last_fertilized_at), fertilizingIntervalDays), 'yyyy-MM-dd')
      }

      const payload = {
        name: data.name,
        nickname: data.nickname || null,
        species: data.species || null,
        location: data.location || null,
        acquisition_date: data.acquisition_date || null,
        notes: data.notes || null,
        status: data.status,
        photo_url: finalPhotoUrl,
        // Watering
        last_watered_at: data.last_watered_at || null,
        next_watered_at: nextWateredAt,
        watering_interval_days: wateringIntervalDays,
        watering_source: wateringSource,
        // Misting
        last_misted_at: data.last_misted_at || null,
        next_misted_at: nextMistedAt,
        misting_interval_days: mistingIntervalDays,
        misting_source: mistingSource,
        // Fertilizing
        last_fertilized_at: data.last_fertilized_at || null,
        next_fertilized_at: nextFertilizedAt,
        fertilizing_interval_days: fertilizingIntervalDays,
        fertilizing_source: fertilizingSource,
        // Care profile
        light_requirement: lightRequirement,
        humidity_preference: humidityPreference,
        soil_type: soilType,
        temperature_min: temperatureMin,
        temperature_max: temperatureMax,
        // Pot
        pot_type: potType,
        pot_diameter_cm: data.pot_diameter_cm ? Number(data.pot_diameter_cm) : null,
        pot_height_cm: data.pot_height_cm ? Number(data.pot_height_cm) : null,
        // Misc
        last_repotted_at: data.last_repotted_at || null,
        // Recommendation — preserved on update, null on create (generated on first open)
        watering_recommendation: plant?.watering_recommendation ?? null,
        watering_recommendation_updated_at: plant?.watering_recommendation_updated_at ?? null,
      }

      if (plant) {
        await updatePlant.mutateAsync(payload)
        toast.success('Plant updated')
        router.push(`/plants/${plant.id}`)
      } else {
        const newPlant = await createPlant.mutateAsync(payload)
        toast.success('Plant added!')
        router.push(`/plants/${newPlant.id}`)
      }
    } catch {
      setLookingUp(false)
      toast.error('Something went wrong. Please try again.')
    }
  }

  const isLoading = createPlant.isPending || updatePlant.isPending || uploading || lookingUp || identifying

  const submitLabel = lookingUp
    ? 'Detecting care schedule…'
    : uploading
    ? 'Uploading photo…'
    : createPlant.isPending || updatePlant.isPending
    ? 'Saving…'
    : plant
    ? 'Save Changes'
    : 'Add Plant'

  const speciesUnchanged = speciesValue === (plant?.species ?? '')

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 px-4 py-4 pb-8">

      {/* Photo */}
      <div className="flex flex-col items-center gap-3">

        {/* Circle — loader → preview → empty */}
        <div className="w-32 h-32 rounded-full bg-stone-200 border-2 border-dashed border-stone-300 flex items-center justify-center overflow-hidden">
          {identifying ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-7 h-7 rounded-full border-2 border-stone-300 border-t-leaf-500 animate-spin" />
              <span className="text-[10px] text-stone-400 font-medium">Identifying…</span>
            </div>
          ) : photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="Plant photo" className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center text-stone-400">
              <Camera size={24} className="mb-1" />
              <span className="text-xs font-medium">No photo</span>
            </div>
          )}
        </div>

        {/* Actions below the circle */}
        {!identifying && identifyFailed ? (
          /* Could not identify */
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="text-xs text-stone-500">Couldn&apos;t identify this plant</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-200 border border-stone-300 text-xs font-medium text-olive-600 hover:bg-stone-300 transition-colors"
              >
                <RefreshCw size={11} />
                Try another photo
              </button>
              <button
                type="button"
                onClick={() => setIdentifyFailed(false)}
                className="px-3 py-1.5 rounded-lg bg-stone-200 border border-stone-300 text-xs font-medium text-olive-600 hover:bg-stone-300 transition-colors"
              >
                Add manually
              </button>
            </div>
          </div>
        ) : !identifying && photoUrl ? (
          /* Photo set and identified (or existing saved photo) */
          <button
            type="button"
            className="text-xs text-stone-400 font-medium"
            onClick={handleRemovePhoto}
          >
            Remove photo
          </button>
        ) : !identifying ? (
          /* No photo yet */
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-200 border border-stone-300 text-xs font-medium text-olive-600 hover:bg-stone-300 transition-colors"
            >
              <Camera size={13} />
              Camera
            </button>
            <button
              type="button"
              onClick={() => galleryRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-200 border border-stone-300 text-xs font-medium text-olive-600 hover:bg-stone-300 transition-colors"
            >
              <ImageIcon size={13} />
              Gallery
            </button>
          </div>
        ) : null}

        {/* Hidden inputs */}
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoChange} />
        <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
      </div>

      {/* Basic info */}
      <div className="bg-stone-100 rounded-xl p-5 border border-stone-300 space-y-4" style={{ boxShadow: '0 2px 12px -2px rgba(0,0,0,0.06)' }}>
        <div>
          <label className="label-caps">Name *</label>
          <input type="text" placeholder="e.g. Monstera Deliciosa" className="input-underline" {...register('name')} />
          {errors.name && <p className="text-xs text-clay-400 mt-1">{errors.name.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-caps">Nickname</label>
            <input type="text" placeholder="e.g. Monty" className="input-underline" {...register('nickname')} />
          </div>
          <div>
            <label className="label-caps">Species</label>
            <input type="text" placeholder="e.g. Monstera deliciosa" className="input-underline" {...register('species')} />
          </div>
        </div>

        {speciesValue && (
          <div className="flex items-center gap-2 text-xs text-olive-500 bg-stone-200 rounded-lg px-3 py-2">
            <Timer size={12} className="text-leaf-500 flex-shrink-0" />
            <span>
              {plant?.watering_interval_days && speciesUnchanged
                ? `Watering every ${plant.watering_interval_days}d${plant.misting_interval_days ? ` · Misting every ${plant.misting_interval_days}d` : ''}`
                : 'Care schedule will be auto-detected on save'}
            </span>
          </div>
        )}

        <div>
          <label className="label-caps">Status</label>
          <div className="flex gap-2 mt-2">
            {STATUS_OPTIONS.map(({ value, label }) => (
              <label
                key={value}
                className={`flex-1 text-center py-2 px-1 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                  status === value
                    ? 'bg-leaf-500 text-stone-50 border-leaf-500'
                    : 'bg-stone-200 border-stone-300 text-olive-500 hover:bg-stone-300'
                }`}
              >
                <input type="radio" className="sr-only" value={value} checked={status === value} onChange={() => setValue('status', value)} />
                {label}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Location & notes */}
      <div className="bg-stone-100 rounded-xl p-5 border border-stone-300 space-y-4" style={{ boxShadow: '0 2px 12px -2px rgba(0,0,0,0.06)' }}>
        <div>
          <label className="label-caps">Location</label>
          <input
            type="text"
            placeholder="e.g. Living Room"
            className="input-underline"
            {...register('location')}
          />
          {existingLocations.length > 0 && (
            <div className="flex gap-2 mt-2 overflow-x-auto pb-0.5 scrollbar-none">
              {existingLocations.map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setValue('location', locationValue === loc ? '' : loc)}
                  className={`flex-shrink-0 px-2.5 py-1 rounded-full border text-[11px] font-medium transition-colors ${
                    locationValue === loc
                      ? 'bg-leaf-500 text-stone-50 border-leaf-500'
                      : 'bg-stone-200 border-stone-300 text-olive-600 hover:bg-stone-300'
                  }`}
                >
                  {loc}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="label-caps">Acquired</label>
          <input type="date" max={format(new Date(), 'yyyy-MM-dd')} className="input-underline" {...register('acquisition_date')} />
        </div>

        <div>
          <label className="label-caps">Notes</label>
          <textarea placeholder="Care instructions, quirks, etc." rows={3} className="input-underline resize-none" {...register('notes')} />
        </div>
      </div>

      {/* Care dates */}
      <div className="bg-stone-100 rounded-xl p-5 border border-stone-300 space-y-4" style={{ boxShadow: '0 2px 12px -2px rgba(0,0,0,0.06)' }}>
        <div>
          <p className="label-caps !mb-0">Initial care dates</p>
          <p className="text-[10px] text-stone-400 mt-1">Next dates are calculated automatically. Future updates via the log.</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-caps">Last watered</label>
            <input type="date" className="input-underline" {...register('last_watered_at')} />
          </div>
          <div className="flex flex-col justify-end">
            {plant?.next_watered_at ? (
              <div>
                <label className="label-caps">Next watering</label>
                <p className="text-sm font-medium text-leaf-700 py-2 border-b border-stone-300">
                  {format(parseISO(plant.next_watered_at), 'MMM d, yyyy')}
                </p>
              </div>
            ) : (
              <div className="text-xs text-stone-400 py-2 italic">Auto-computed on save</div>
            )}
          </div>
          <div>
            <label className="label-caps">Last misted</label>
            <input type="date" className="input-underline" {...register('last_misted_at')} />
          </div>
          <div>
            <label className="label-caps">Last fertilized</label>
            <input type="date" className="input-underline" {...register('last_fertilized_at')} />
          </div>
          <div>
            <label className="label-caps">Last repotted</label>
            <input type="date" className="input-underline" {...register('last_repotted_at')} />
          </div>
        </div>
      </div>

      {/* Pot info */}
      <div className="bg-stone-100 rounded-xl p-5 border border-stone-300 space-y-4" style={{ boxShadow: '0 2px 12px -2px rgba(0,0,0,0.06)' }}>
        <p className="label-caps !mb-0">Pot</p>

        <div>
          <label className="label-caps">Type</label>
          <div className="flex flex-wrap gap-2 mt-2">
            {POT_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setPotType(potType === type ? null : type)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                  potType === type
                    ? 'bg-leaf-500 text-stone-50 border-leaf-500'
                    : 'bg-stone-200 border-stone-300 text-olive-500 hover:bg-stone-300'
                }`}
              >
                {POT_LABELS[type]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-caps">Diameter (cm)</label>
            <input
              type="number"
              min="1"
              max="200"
              placeholder="e.g. 14"
              className="input-underline"
              {...register('pot_diameter_cm')}
            />
          </div>
          <div>
            <label className="label-caps">Height (cm)</label>
            <input
              type="number"
              min="1"
              max="200"
              placeholder="e.g. 12"
              className="input-underline"
              {...register('pot_height_cm')}
            />
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-leaf-500 text-stone-50 font-medium text-lg py-4 rounded-xl hover:bg-leaf-600 transition-colors disabled:opacity-60"
      >
        {submitLabel}
      </button>
    </form>
  )
}
