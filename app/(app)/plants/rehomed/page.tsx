'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArchiveRestore, HelpCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Header } from '@/components/layout/header'
import { DailyQuote } from '@/components/plants/daily-quote'
import { MemorialCard } from '@/components/plants/memorial-card'
import { GoodbyeSheet } from '@/components/plants/goodbye-sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { useDepartedPlants, useRestorePlant } from '@/lib/hooks/use-plants'
import { DEPARTURE_REASONS, HEAVEN_PATH, REHOMED_QUOTES, displayName } from '@/lib/departure'
import type { Plant } from '@/lib/types'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="label-caps text-olive-500">{title}</h2>
      {children}
    </section>
  )
}

export default function RehomedPage() {
  const router = useRouter()
  const { data, isLoading } = useDepartedPlants()
  const restore = useRestorePlant()
  const [sorting, setSorting] = useState<Plant | null>(null)

  const plants = data ?? []
  const givenAway = plants.filter((p) => p.departure_reason === 'given_away')
  const leftBehind = plants.filter((p) => p.departure_reason === 'left_behind')
  const unsorted = plants.filter((p) => !p.departure_reason)

  // Group "stayed behind" plants by the home they stayed at
  const byPlace = new Map<string, Plant[]>()
  for (const p of leftBehind) {
    const key = p.departure_place || 'An old home'
    byPlace.set(key, [...(byPlace.get(key) ?? []), p])
  }

  const isEmpty = givenAway.length + leftBehind.length + unsorted.length === 0

  async function handleRestore(plant: Plant) {
    const name = displayName(plant)
    if (!confirm(`Bring ${name} back to your collection?`)) return
    try {
      await restore.mutateAsync(plant)
      toast.success(`${name} is back home 🌱`, {
        action: { label: 'View', onClick: () => router.push(`/plants/${plant.id}`) },
      })
    } catch {
      toast.error('Failed to bring it back')
    }
  }

  const restoreButton = (plant: Plant) => (
    <button
      onClick={() => handleRestore(plant)}
      disabled={restore.isPending}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-leaf-500 hover:text-leaf-700 disabled:opacity-50"
    >
      <ArchiveRestore size={14} /> I got it back
    </button>
  )

  return (
    <>
      <Header title="Rehomed" showBack />

      <DailyQuote quotes={REHOMED_QUOTES} emoji="🌱" />

      <main className="px-4 pb-8 space-y-8">
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
          </div>
        ) : isEmpty ? (
          <div className="text-center py-10 space-y-2">
            <p className="text-olive-500 text-sm">Plants you give away or leave at an old home will appear here.</p>
            <Link href={HEAVEN_PATH} className="text-xs text-leaf-500 hover:underline">
              Visit Plant Heaven
            </Link>
          </div>
        ) : (
          <>
            {unsorted.length > 0 && (
              <Section title="Needs a place">
                <p className="text-xs text-stone-500 -mt-1">
                  These were archived before Plant Heaven and Rehomed existed. Tell us what happened to them.
                </p>
                {unsorted.map((plant) => (
                  <MemorialCard
                    key={plant.id}
                    plant={plant}
                    tone="rehomed"
                    action={
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => setSorting(plant)}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-leaf-700 hover:text-leaf-500"
                        >
                          <HelpCircle size={14} /> What happened?
                        </button>
                        {restoreButton(plant)}
                      </div>
                    }
                  />
                ))}
              </Section>
            )}

            {givenAway.length > 0 && (
              <Section title={`${DEPARTURE_REASONS.given_away.emoji} Given away`}>
                {givenAway.map((plant) => (
                  <MemorialCard
                    key={plant.id}
                    plant={plant}
                    tone="rehomed"
                    subtitle={plant.departure_note}
                    action={restoreButton(plant)}
                  />
                ))}
              </Section>
            )}

            {[...byPlace.entries()].map(([place, group]) => (
              <Section
                key={place}
                title={`${DEPARTURE_REASONS.left_behind.emoji} ${place} · ${group.length} ${group.length === 1 ? 'plant' : 'plants'}`}
              >
                {group.map((plant) => (
                  <MemorialCard
                    key={plant.id}
                    plant={plant}
                    tone="rehomed"
                    subtitle={plant.departure_note}
                    action={restoreButton(plant)}
                  />
                ))}
              </Section>
            ))}
          </>
        )}
      </main>

      {sorting && (
        <GoodbyeSheet
          plant={sorting}
          mode="edit"
          open={!!sorting}
          onOpenChange={(o) => !o && setSorting(null)}
          onDone={(reason) => {
            const name = displayName(sorting)
            if (reason === 'passed_away') {
              toast.success(`${name} is now in Plant Heaven 🕊`, {
                action: { label: 'View', onClick: () => router.push(HEAVEN_PATH) },
              })
            } else {
              toast.success(`${name} found its place`)
            }
          }}
        />
      )}
    </>
  )
}
