'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { motion } from 'framer-motion'
import { ChevronLeft } from 'lucide-react'
import { toast } from 'sonner'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useSetDeparture } from '@/lib/hooks/use-plants'
import { DEPARTURE_REASONS, displayName } from '@/lib/departure'
import type { DepartureReason, Plant } from '@/lib/types'

const REASON_ORDER: DepartureReason[] = ['passed_away', 'given_away', 'left_behind']

interface GoodbyeSheetProps {
  plant: Plant
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * goodbye — the plant is still in the collection; ends with a farewell moment.
   * edit    — the plant already left; change reason / date / note / place.
   */
  mode?: 'goodbye' | 'edit'
  onDone?: (reason: DepartureReason) => void
}

type Step = 'reason' | 'details' | 'farewell'

export function GoodbyeSheet({ plant, open, onOpenChange, mode = 'goodbye', onDone }: GoodbyeSheetProps) {
  // While the farewell animation plays the sheet can't be dismissed
  const [locked, setLocked] = useState(false)

  return (
    <Sheet open={open} onOpenChange={(o) => !locked && onOpenChange(o)}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-2xl">
        {/* Mounted fresh on every open, so the form always starts from the plant's current values */}
        {open && (
          <GoodbyeFlow
            plant={plant}
            mode={mode}
            onLock={setLocked}
            onClose={() => onOpenChange(false)}
            onDone={onDone}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function GoodbyeFlow({ plant, mode, onLock, onClose, onDone }: {
  plant: Plant
  mode: 'goodbye' | 'edit'
  onLock: (locked: boolean) => void
  onClose: () => void
  onDone?: (reason: DepartureReason) => void
}) {
  const setDeparture = useSetDeparture()
  const name = displayName(plant)
  const today = format(new Date(), 'yyyy-MM-dd')

  const [step, setStep] = useState<Step>(mode === 'edit' && plant.departure_reason ? 'details' : 'reason')
  const [reason, setReason] = useState<DepartureReason | null>(plant.departure_reason)
  const [date, setDate] = useState(plant.archived_at ? format(parseISO(plant.archived_at), 'yyyy-MM-dd') : today)
  const [note, setNote] = useState(plant.departure_note ?? '')
  const [place, setPlace] = useState(plant.departure_place ?? plant.location ?? '')

  function chooseReason(r: DepartureReason) {
    setReason(r)
    setStep('details')
  }

  async function handleSubmit() {
    if (!reason) return
    try {
      await setDeparture.mutateAsync({
        id: plant.id,
        reason,
        date,
        note,
        place: reason === 'left_behind' ? place : null,
      })
    } catch {
      toast.error('Something went wrong. Please try again.')
      return
    }
    if (mode === 'edit') {
      onClose()
      onDone?.(reason)
      return
    }
    setStep('farewell')
    onLock(true)
    setTimeout(() => {
      onLock(false)
      onClose()
      onDone?.(reason)
    }, 1800)
  }

  const meta = reason ? DEPARTURE_REASONS[reason] : null

  return (
    <>
      {step === 'reason' && (
        <>
          <SheetHeader className="mb-4">
            <SheetTitle>What happened to {name}?</SheetTitle>
          </SheetHeader>
          <div className="space-y-3 px-4 pb-6">
            {REASON_ORDER.map((r) => {
              const m = DEPARTURE_REASONS[r]
              return (
                <button
                  key={r}
                  onClick={() => chooseReason(r)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-colors ${
                    reason === r ? 'border-leaf-400 bg-leaf-500/5' : 'border-stone-300 bg-stone-100 hover:border-stone-400'
                  }`}
                >
                  <span className="text-2xl">{m.emoji}</span>
                  <span className="text-sm font-medium text-leaf-700">{m.choice}</span>
                </button>
              )
            })}
          </div>
        </>
      )}

      {step === 'details' && meta && reason && (
        <>
          <SheetHeader className="mb-2 items-start">
            <button
              onClick={() => setStep('reason')}
              className="inline-flex items-center gap-1 text-sm text-olive-500 hover:text-leaf-700 mb-2"
            >
              <ChevronLeft size={16} /> {meta.emoji} {meta.choice}
            </button>
            <SheetTitle>{mode === 'edit' ? `Edit ${name}'s memory` : `Saying goodbye to ${name}`}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-6">
            <div className="space-y-1.5">
              <label className="label-caps" htmlFor="departure-date">When</label>
              <input
                id="departure-date"
                type="date"
                value={date}
                max={today}
                onChange={(e) => e.target.value && setDate(e.target.value)}
                className="w-full bg-stone-100 border border-stone-300 rounded-xl px-3 py-2.5 text-sm text-leaf-700 focus:outline-none focus:border-leaf-400"
              />
            </div>

            {reason === 'left_behind' && (
              <div className="space-y-1.5">
                <label className="label-caps" htmlFor="departure-place">Where it stayed</label>
                <input
                  id="departure-place"
                  value={place}
                  onChange={(e) => setPlace(e.target.value)}
                  placeholder="e.g. Old flat in Prague (optional)"
                  className="w-full bg-stone-100 border border-stone-300 rounded-xl px-3 py-2.5 text-sm text-leaf-700 placeholder-stone-400 focus:outline-none focus:border-leaf-400"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="label-caps" htmlFor="departure-note">
                {reason === 'passed_away' ? 'In memory' : 'Note'}
              </label>
              <textarea
                id="departure-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={meta.notePlaceholder}
                rows={3}
                className="w-full bg-stone-100 border border-stone-300 rounded-xl px-3 py-2.5 text-sm text-leaf-700 placeholder-stone-400 focus:outline-none focus:border-leaf-400 resize-none"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={setDeparture.isPending}
              className="w-full py-3 bg-leaf-500 text-stone-50 text-sm font-medium rounded-xl hover:bg-leaf-600 transition-colors disabled:opacity-60"
            >
              {setDeparture.isPending ? 'Saving…' : mode === 'edit' ? 'Save' : 'Say goodbye'}
            </button>
          </div>
        </>
      )}

      {step === 'farewell' && meta && (
        <>
          <SheetHeader className="sr-only">
            <SheetTitle>Goodbye</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col items-center justify-center text-center py-14 px-6">
            <motion.div
              initial={{ y: 0, rotate: 0, opacity: 1 }}
              animate={{ y: -70, rotate: 25, opacity: 0 }}
              transition={{ duration: 1.6, ease: 'easeOut' }}
              className="text-5xl mb-2"
              aria-hidden
            >
              🍃
            </motion.div>
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="text-leaf-700 font-medium"
            >
              {meta.farewell(name)}
            </motion.p>
          </div>
        </>
      )}
    </>
  )
}
