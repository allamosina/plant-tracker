'use client'

import Link from 'next/link'
import { Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { usePlants } from '@/lib/hooks/use-plants'
import { PlantCard } from '@/components/plants/plant-card'
import { Skeleton } from '@/components/ui/skeleton'

export function PlantListClient() {
  const { data: plants, isLoading, error } = usePlants()
  const [search, setSearch] = useState('')

  const filtered = plants?.filter((p) => {
    const q = search.toLowerCase()
    return (
      p.name.toLowerCase().includes(q) ||
      p.nickname?.toLowerCase().includes(q) ||
      p.species?.toLowerCase().includes(q) ||
      p.location?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="px-4 py-4 space-y-5">
      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
        <input
          placeholder="Search plants…"
          className="w-full bg-stone-100 border border-stone-300 rounded-xl pl-9 pr-4 py-2.5 text-sm text-leaf-700 placeholder-stone-400 focus:outline-none focus:border-leaf-400 transition-colors"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading && (
        <div className="grid grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
        </div>
      )}

      {error && (
        <p className="text-sm text-clay-400 text-center py-8">Failed to load plants. Please try again.</p>
      )}

      {!isLoading && filtered?.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="text-5xl">🌱</div>
          {search ? (
            <p className="text-olive-500 text-sm">No plants match &ldquo;{search}&rdquo;</p>
          ) : (
            <>
              <p className="text-olive-500 text-sm">Your collection is empty</p>
              <Link
                href="/plants/new"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-leaf-500 text-stone-50 text-sm font-medium rounded-xl hover:bg-leaf-600 transition-colors"
              >
                <Plus size={16} /> Add your first plant
              </Link>
            </>
          )}
        </div>
      )}

      {filtered && filtered.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {filtered.map((plant) => (
            <PlantCard key={plant.id} plant={plant} />
          ))}
        </div>
      )}
    </div>
  )
}
