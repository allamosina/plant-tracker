'use client'

import { useParams } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { PlantForm } from '@/components/plants/plant-form'
import { usePlant } from '@/lib/hooks/use-plants'
import { Skeleton } from '@/components/ui/skeleton'

export default function EditPlantPage() {
  const { id } = useParams<{ id: string }>()
  const { data: plant, isLoading } = usePlant(id)

  return (
    <>
      <Header title="Edit plant" showBack />
      {isLoading ? (
        <div className="px-4 py-4 space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      ) : plant ? (
        <PlantForm plant={plant} />
      ) : (
        <p className="text-center text-muted-foreground py-8">Plant not found.</p>
      )}
    </>
  )
}
