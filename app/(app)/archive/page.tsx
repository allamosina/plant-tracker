'use client'

import Image from 'next/image'
import { ArchiveRestore, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { Header } from '@/components/layout/header'
import { useArchivedPlants, useDeletePlant } from '@/lib/hooks/use-plants'
import { createClient } from '@/lib/supabase/client'
import { Skeleton } from '@/components/ui/skeleton'

export default function ArchivePage() {
  const { data: plants, isLoading } = useArchivedPlants()
  const deleteP = useDeletePlant()
  const queryClient = useQueryClient()

  async function handleRestore(id: string, name: string) {
    try {
      const supabase = createClient()
      const { error } = await supabase.from('plants').update({ archived_at: null }).eq('id', id)
      if (error) throw error
      queryClient.invalidateQueries({ queryKey: ['plants'] })
      toast.success(`${name} restored to collection`)
    } catch {
      toast.error('Failed to restore')
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Permanently delete ${name}? This cannot be undone.`)) return
    try {
      await deleteP.mutateAsync(id)
      queryClient.invalidateQueries({ queryKey: ['plants', 'archived'] })
      toast.success(`${name} deleted`)
    } catch {
      toast.error('Failed to delete')
    }
  }

  return (
    <>
      <Header title="Archive" showBack />

      <main className="px-4 py-4">
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : !plants?.length ? (
          <div className="flex flex-col items-center justify-center text-center p-8 min-h-[50vh]">
            <div className="w-16 h-16 bg-stone-200 border border-stone-300 rounded-full flex items-center justify-center mb-4" style={{ boxShadow: '0 2px 12px -2px rgba(0,0,0,0.06)' }}>
              <span className="text-3xl">📦</span>
            </div>
            <h3 className="text-lg font-medium text-leaf-700 mb-2">Archive is empty</h3>
            <p className="text-olive-500 text-sm">Plants you archive will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {plants.map((plant) => (
              <div
                key={plant.id}
                className="bg-stone-100 rounded-xl p-4 border border-stone-300 flex items-center gap-4"
                style={{ boxShadow: '0 2px 12px -2px rgba(0,0,0,0.06)' }}
              >
                <div className="w-14 h-14 rounded-lg bg-stone-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {plant.photo_url ? (
                    <Image
                      src={plant.photo_url}
                      alt={plant.name}
                      width={56}
                      height={56}
                      className="w-full h-full object-cover grayscale opacity-70"
                    />
                  ) : (
                    <span className="text-2xl grayscale opacity-70">🪴</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-leaf-700 truncate">{plant.name}</h3>
                  <p className="text-xs text-stone-500">Archived</p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleRestore(plant.id, plant.name)}
                    className="p-2 rounded-full bg-stone-200 text-leaf-700 hover:bg-stone-300 transition-colors"
                    aria-label="Restore plant"
                  >
                    <ArchiveRestore size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(plant.id, plant.name)}
                    className="p-2 rounded-full bg-clay-400/10 text-clay-500 hover:bg-clay-400/20 transition-colors"
                    aria-label="Delete permanently"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  )
}
