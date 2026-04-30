import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { parseISO, isBefore, startOfToday, addDays, format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { computeSmartFertilizingInterval } from '@/lib/utils/smart-interval'
import type { Plant, UpcomingTask } from '@/lib/types'

/**
 * Derives the first-fertilizing date for a plant that doesn't have a stored
 * next_fertilized_at yet. Falls back to acquisition_date + 21 days, or
 * created_at + 21 days when acquisition_date isn't set. Returns null if the
 * archetype-based schedule is currently suspended (recent repot or
 * winter + low light).
 *
 * Works regardless of whether fertilizing_interval_days is stored on the
 * plant — almost every plant benefits from periodic feeding, and the smart
 * interval is computed from archetype constants, not from the stored value.
 */
function deriveFertilizingDate(plant: Plant): string | null {
  // Bypass the "is fertilizing enabled" gate in computeSmartFertilizingInterval
  // by passing a non-null placeholder; the actual interval comes from FERTILIZE_BASE.
  const plantForCompute = plant.fertilizing_interval_days
    ? plant
    : { ...plant, fertilizing_interval_days: 1 }
  const fertResult = computeSmartFertilizingInterval(plantForCompute, null)
  if (!fertResult || fertResult.suspended) return null

  // Already fertilized at least once → schedule the next from there
  if (plant.last_fertilized_at) {
    return format(addDays(parseISO(plant.last_fertilized_at), fertResult.days), 'yyyy-MM-dd')
  }

  // No history → wait 3 weeks from acquisition (or from when added to the app)
  const from = plant.acquisition_date
    ? parseISO(plant.acquisition_date)
    : parseISO(plant.created_at)
  return format(addDays(from, 21), 'yyyy-MM-dd')
}

export function useLocations() {
  return useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('plants')
        .select('location')
        .is('archived_at', null)
        .not('location', 'is', null)
      if (error) throw error
      const locs = [...new Set(data.map((r: { location: string }) => r.location as string))]
      return locs.sort() as string[]
    },
  })
}

export function useArchivedPlants() {
  return useQuery({
    queryKey: ['plants', 'archived'],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('plants')
        .select('*')
        .not('archived_at', 'is', null)
        .order('archived_at', { ascending: false })
      if (error) throw error
      return data as Plant[]
    },
  })
}

export function usePlants() {
  return useQuery({
    queryKey: ['plants'],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('plants')
        .select('*')
        .is('archived_at', null)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data as Plant[]
    },
  })
}

export function usePlant(id: string) {
  return useQuery({
    queryKey: ['plants', id],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('plants')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as Plant
    },
  })
}

/** Returns all upcoming + overdue care tasks sorted by due date. */
export function useUpcomingTasks() {
  const { data: plants, isLoading } = usePlants()

  const tasks: UpcomingTask[] = []
  const today = startOfToday()

  if (plants) {
    for (const plant of plants) {
      const checks: Array<{ type: UpcomingTask['type']; date: string | null }> = [
        { type: 'check_soil', date: plant.next_check_soil_at },
        { type: 'watering', date: plant.next_watered_at },
        { type: 'misting', date: plant.next_misted_at },
        { type: 'fertilizing', date: plant.next_fertilized_at ?? deriveFertilizingDate(plant) },
      ]
      for (const { type, date } of checks) {
        if (!date) continue
        tasks.push({
          key: `${plant.id}-${type}`,
          plant,
          type,
          dueDate: date,
        })
      }
    }
    tasks.sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  }

  return { tasks, isLoading }
}

export function useCreatePlant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (
      values: Omit<Plant, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'archived_at'>
    ) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { data, error } = await supabase
        .from('plants')
        .insert({ ...values, user_id: user.id })
        .select()
        .single()
      if (error) throw error
      return data as Plant
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plants'] })
    },
  })
}

export function useUpdatePlant(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (
      values: Partial<Omit<Plant, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
    ) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('plants')
        .update(values)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Plant
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plants'] })
      queryClient.invalidateQueries({ queryKey: ['plants', id] })
    },
  })
}

export function useArchivePlant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('plants')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plants'] })
    },
  })
}

export function useDeletePlant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase.from('plants').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plants'] })
    },
  })
}
