'use client'

import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { DailyQuote } from '@/components/plants/daily-quote'
import { MemorialCard } from '@/components/plants/memorial-card'
import { Skeleton } from '@/components/ui/skeleton'
import { useDepartedPlants } from '@/lib/hooks/use-plants'
import { HEAVEN_QUOTES, REHOMED_PATH } from '@/lib/departure'

export default function PlantHeavenPage() {
  const { data, isLoading } = useDepartedPlants()
  const plants = data?.filter((p) => p.departure_reason === 'passed_away') ?? []

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#DDE3EC] via-[#ECE6E4] to-stone-50">
      <Header title="Plant Heaven" showBack transparent />

      <DailyQuote quotes={HEAVEN_QUOTES} emoji="🕊" />

      <main className="px-4 pb-8">
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
          </div>
        ) : plants.length === 0 ? (
          <div className="text-center py-10 space-y-2">
            <p className="text-olive-500 text-sm">No one is here yet — and that’s a good thing.</p>
            <Link href={REHOMED_PATH} className="text-xs text-leaf-500 hover:underline">
              See plants that were rehomed
            </Link>
          </div>
        ) : (
          <>
            <p className="label-caps text-center mb-4 text-olive-500">
              Remembering {plants.length} {plants.length === 1 ? 'plant' : 'plants'}
            </p>
            <div className="space-y-3">
              {plants.map((plant) => (
                <MemorialCard key={plant.id} plant={plant} tone="heaven" />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
