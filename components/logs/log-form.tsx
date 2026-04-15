'use client'

import { useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Camera, X, Droplets, Sprout, Leaf, Scissors, AlertCircle, Wind } from 'lucide-react'
import Image from 'next/image'
import { format } from 'date-fns'
import { useCreateLog, useUpdateLog } from '@/lib/hooks/use-logs'
import { usePhotoUpload } from '@/lib/hooks/use-photo-upload'
import { logTypeLabel } from './log-type-icon'
import type { LogType, PlantLog } from '@/lib/types'

const LOG_TYPES: { type: LogType; icon: React.ElementType; color: string }[] = [
  { type: 'watering',       icon: Droplets,    color: 'text-leaf-400 bg-leaf-500/10 border-leaf-400'   },
  { type: 'misting',        icon: Wind,        color: 'text-sky-500 bg-sky-100 border-sky-400'          },
  { type: 'fertilizing',    icon: Sprout,      color: 'text-olive-400 bg-olive-400/10 border-olive-400' },
  { type: 'repotting',      icon: Leaf,        color: 'text-clay-500 bg-clay-500/10 border-clay-500'    },
  { type: 'pruning',        icon: Scissors,    color: 'text-stone-500 bg-stone-200 border-stone-400'    },
  { type: 'issue_observed', icon: AlertCircle, color: 'text-clay-400 bg-clay-400/10 border-clay-400'   },
]

const ISSUE_DETAILS = ['yellow leaves', 'brown tips', 'drooping', 'pests suspected', 'other']

const schema = z.object({
  type: z.enum(['watering', 'misting', 'fertilizing', 'repotting', 'pruning', 'issue_observed'] as const),
  date: z.string().min(1, 'Date is required'),
  note: z.string().optional(),
  issue_description: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface LogFormProps {
  plantId: string
  log?: PlantLog
  wateringIntervalDays?: number | null
  mistingIntervalDays?: number | null
  fertilizingIntervalDays?: number | null
  onSuccess?: () => void
}

export function LogForm({
  plantId,
  log,
  wateringIntervalDays,
  mistingIntervalDays,
  fertilizingIntervalDays,
  onSuccess,
}: LogFormProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(log?.photo_url ?? null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)

  const createLog = useCreateLog()
  const updateLog = useUpdateLog(log?.id ?? '')
  const { uploadPhoto, uploading } = usePhotoUpload()

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: log?.type ?? 'watering',
      date: log?.date ?? format(new Date(), 'yyyy-MM-dd'),
      note: log?.note ?? '',
      issue_description: log?.issue_description ?? '',
    },
  })

  const selectedType = watch('type')

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoUrl(URL.createObjectURL(file))
  }

  async function onSubmit(data: FormData) {
    try {
      let finalPhotoUrl = photoUrl
      if (photoFile) finalPhotoUrl = await uploadPhoto(photoFile, 'logs')

      const payload = {
        plant_id: plantId,
        type: data.type,
        date: data.date,
        note: data.note || null,
        issue_description: data.type === 'issue_observed' ? (data.issue_description || null) : null,
        photo_url: finalPhotoUrl,
      }

      if (log) {
        await updateLog.mutateAsync(payload)
        toast.success('Log updated')
      } else {
        await createLog.mutateAsync({
          ...payload,
          wateringIntervalDays,
          mistingIntervalDays,
          fertilizingIntervalDays,
        })
        toast.success('Care logged!')
      }
      onSuccess?.()
    } catch {
      toast.error('Something went wrong. Please try again.')
    }
  }

  const isLoading = createLog.isPending || updateLog.isPending || uploading

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 px-1 pb-4">
      {/* Log type grid — 3 cols to fit 6 types */}
      <div>
        <label className="label-caps">Action type</label>
        <div className="grid grid-cols-3 gap-2 mt-2">
          {LOG_TYPES.map(({ type, icon: Icon, color }) => {
            const active = selectedType === type
            return (
              <button
                key={type}
                type="button"
                onClick={() => setValue('type', type)}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                  active
                    ? `${color} shadow-sm scale-105`
                    : 'bg-stone-100 border-stone-300 text-stone-400 hover:bg-stone-200'
                }`}
              >
                <Icon size={22} className="mb-1" />
                <span className="text-[9px] font-medium uppercase tracking-wider leading-tight text-center">
                  {logTypeLabel(type).split(' ')[0]}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Issue detail chips */}
      {selectedType === 'issue_observed' && (
        <div className="bg-clay-400/10 rounded-xl p-4 border border-clay-400/20">
          <label className="label-caps text-clay-500">What&apos;s wrong?</label>
          <div className="flex flex-wrap gap-2 mt-2">
            {ISSUE_DETAILS.map((detail) => {
              const current = watch('issue_description')
              const active = current === detail
              return (
                <button
                  key={detail}
                  type="button"
                  onClick={() => setValue('issue_description', active ? '' : detail)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                    active
                      ? 'bg-clay-400 text-stone-50 border-clay-500'
                      : 'bg-stone-100 text-clay-500 border-stone-300 hover:bg-stone-200'
                  }`}
                >
                  {detail.charAt(0).toUpperCase() + detail.slice(1)}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Date */}
      <div className="bg-stone-100 rounded-xl p-5 border border-stone-300 space-y-4" style={{ boxShadow: '0 2px 12px -2px rgba(0,0,0,0.06)' }}>
        <div>
          <label className="label-caps">Date</label>
          <input
            type="date"
            max={format(new Date(), 'yyyy-MM-dd')}
            className="input-underline"
            {...register('date')}
          />
          {errors.date && <p className="text-xs text-clay-400 mt-1">{errors.date.message}</p>}
        </div>

        <div>
          <label className="label-caps">Notes (optional)</label>
          <textarea
            placeholder="Add any details…"
            rows={2}
            className="input-underline resize-none"
            {...register('note')}
          />
        </div>
      </div>

      {/* Photo */}
      <div>
        <label className="label-caps mb-2 block">Photo (optional)</label>
        {photoUrl ? (
          <div className="relative h-36 rounded-xl overflow-hidden bg-stone-200">
            <Image src={photoUrl} alt="Log photo" fill className="object-cover" sizes="400px" />
            <button
              type="button"
              className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1"
              onClick={() => { setPhotoUrl(null); setPhotoFile(null) }}
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full h-24 border-2 border-dashed border-stone-300 rounded-xl flex items-center justify-center gap-2 text-stone-400 hover:border-leaf-400 hover:text-olive-500 transition-colors"
          >
            <Camera size={20} />
            <span className="text-sm font-medium">Add photo</span>
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={handlePhotoChange} />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-leaf-500 text-stone-50 font-medium text-base py-4 rounded-xl hover:bg-leaf-600 transition-colors disabled:opacity-60"
      >
        {isLoading ? 'Saving…' : log ? 'Save changes' : 'Log care'}
      </button>
    </form>
  )
}
