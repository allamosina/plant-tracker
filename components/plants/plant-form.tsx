'use client'

import { useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Camera, Timer } from 'lucide-react'
import Image from 'next/image'
import { format, addDays, parseISO } from 'date-fns'
import { useCreatePlant, useUpdatePlant } from '@/lib/hooks/use-plants'
import { usePhotoUpload } from '@/lib/hooks/use-photo-upload'
import { lookupCareProfile } from '@/lib/actions/species-lookup'
import type { Plant, PlantStatus } from '@/lib/types'

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
  next_fertilized_at: z.string().optional(),
  last_repotted_at: z.string().optional(),
})

type FormData = z.infer<typeof schema>

const STATUS_OPTIONS: { value: PlantStatus; label: string }[] = [
  { value: 'healthy', label: 'Healthy' },
  { value: 'needs_attention', label: 'Needs Attention' },
  { value: 'recovering', label: 'Recovering' },
]

export function PlantForm({ plant }: { plant?: Plant }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(plant?.photo_url ?? null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [lookingUp, setLookingUp] = useState(false)

  const createPlant = useCreatePlant()
  const updatePlant = useUpdatePlant(plant?.id ?? '')
  const { uploadPhoto, uploading } = usePhotoUpload()

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
      next_fertilized_at: plant?.next_fertilized_at ?? '',
      last_repotted_at: plant?.last_repotted_at ?? '',
    },
  })

  const status = watch('status')
  const speciesValue = watch('species')

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoUrl(URL.createObjectURL(file))
  }

  async function onSubmit(data: FormData) {
    try {
      let finalPhotoUrl = photoUrl
      if (photoFile) finalPhotoUrl = await uploadPhoto(photoFile, 'plants')

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
          // Misting and fertilizing intervals always come from Claude (Perenual doesn't provide them)
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

      // Compute next_watered_at from last_watered_at + interval
      let nextWateredAt: string | null = plant?.next_watered_at ?? null
      if (data.last_watered_at && wateringIntervalDays) {
        nextWateredAt = format(addDays(parseISO(data.last_watered_at), wateringIntervalDays), 'yyyy-MM-dd')
      }

      // Compute next_misted_at from last_misted_at + interval (or today as fallback)
      let nextMistedAt: string | null = plant?.next_misted_at ?? null
      if (data.last_misted_at && mistingIntervalDays) {
        nextMistedAt = format(addDays(parseISO(data.last_misted_at), mistingIntervalDays), 'yyyy-MM-dd')
      } else if (mistingIntervalDays && !nextMistedAt) {
        nextMistedAt = format(addDays(new Date(), mistingIntervalDays), 'yyyy-MM-dd')
      }

      // Compute next_fertilized_at
      let nextFertilizedAt: string | null = data.next_fertilized_at || plant?.next_fertilized_at || null
      if (data.last_fertilized_at && fertilizingIntervalDays && !data.next_fertilized_at) {
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
        // Misc
        last_repotted_at: data.last_repotted_at || null,
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

  const isLoading = createPlant.isPending || updatePlant.isPending || uploading || lookingUp

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
      <div className="flex flex-col items-center justify-center">
        <div
          className="w-32 h-32 rounded-full bg-stone-200 border-2 border-dashed border-stone-300 flex items-center justify-center overflow-hidden relative cursor-pointer hover:border-leaf-400 transition-colors mb-2"
          onClick={() => fileRef.current?.click()}
        >
          {photoUrl ? (
            <Image src={photoUrl} alt="Plant photo" fill className="object-cover" sizes="128px" />
          ) : (
            <div className="flex flex-col items-center text-stone-400">
              <Camera size={24} className="mb-1" />
              <span className="text-xs font-medium">Add Photo</span>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="absolute inset-0 opacity-0 cursor-pointer"
            onChange={handlePhotoChange}
          />
        </div>
        {photoUrl && (
          <button
            type="button"
            className="text-xs text-clay-500 font-medium"
            onClick={() => { setPhotoUrl(null); setPhotoFile(null) }}
          >
            Remove Photo
          </button>
        )}
      </div>

      {/* Basic info card */}
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

      {/* Location & notes card */}
      <div className="bg-stone-100 rounded-xl p-5 border border-stone-300 space-y-4" style={{ boxShadow: '0 2px 12px -2px rgba(0,0,0,0.06)' }}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-caps">Location</label>
            <input type="text" placeholder="e.g. Living Room" className="input-underline" {...register('location')} />
          </div>
          <div>
            <label className="label-caps">Acquired</label>
            <input type="date" max={format(new Date(), 'yyyy-MM-dd')} className="input-underline" {...register('acquisition_date')} />
          </div>
        </div>
        <div>
          <label className="label-caps">Notes</label>
          <textarea placeholder="Care instructions, quirks, etc." rows={3} className="input-underline resize-none" {...register('notes')} />
        </div>
      </div>

      {/* Care dates card */}
      <div className="bg-stone-100 rounded-xl p-5 border border-stone-300 space-y-4" style={{ boxShadow: '0 2px 12px -2px rgba(0,0,0,0.06)' }}>
        <div>
          <p className="label-caps !mb-0">Initial care dates</p>
          <p className="text-[10px] text-stone-400 mt-1">Next watering is calculated automatically. Future care updates via the log.</p>
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
            <label className="label-caps">Next fertilizing</label>
            <input type="date" className="input-underline" {...register('next_fertilized_at')} />
          </div>
          <div>
            <label className="label-caps">Last repotted</label>
            <input type="date" className="input-underline" {...register('last_repotted_at')} />
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
