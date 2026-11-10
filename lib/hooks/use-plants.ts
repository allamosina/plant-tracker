import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { parseISO, isBefore, startOfToday, addDays, format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import type { DepartureReason, Plant, UpcomingTask } from '@/lib/types'

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

/** All plants that left the collection (Plant Heaven + Rehomed), most recent first. */
export function useDepartedPlants() {
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

/** Counts for the Plant Heaven / Rehomed entrances. Unsorted plants count as Rehomed. */
export function useDepartedCounts() {
  const { data } = useDepartedPlants()
  const plants = data ?? []
  const heaven = plants.filter((p) => p.departure_reason === 'passed_away').length
  const unsorted = plants.filter((p) => !p.departure_reason).length
  return { heaven, rehomed: plants.length - heaven, unsorted, total: plants.length }
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
        { type: 'fertilizing', date: plant.next_fertilized_at },
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
      values: Omit<
        Plant,
        'id' | 'user_id' | 'created_at' | 'updated_at' | 'archived_at' | 'departure_reason' | 'departure_note' | 'departure_place'
      >
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

export interface DepartureInput {
  id: string
  reason: DepartureReason
  /** YYYY-MM-DD */
  date: string
  note: string | null
  place: string | null
}

/** Say goodbye to a plant, or edit how it left (reason, date, note, place). */
export function useSetDeparture() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, reason, date, note, place }: DepartureInput) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('plants')
        .update({
          // Noon local time keeps the calendar day stable across time zones
          archived_at: new Date(`${date}T12:00:00`).toISOString(),
          departure_reason: reason,
          departure_note: note?.trim() || null,
          departure_place: place?.trim() || null,
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plants'] })
    },
  })
}

/**
 * Bring a plant back into the collection. Care dates from before it left are
 * stale, so instead of flooding Tasks with overdue items we ask to check the
 * soil today and push any overdue misting/fertilizing to a fresh cycle.
 */
export function useRestorePlant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (plant: Plant) => {
      const today = startOfToday()
      const todayStr = format(today, 'yyyy-MM-dd')
      const freshCycle = (next: string | null, interval: number | null) => {
        if (!next || !isBefore(parseISO(next), today)) return next
        return format(addDays(today, interval ?? 7), 'yyyy-MM-dd')
      }
      const supabase = createClient()
      const { error } = await supabase
        .from('plants')
        .update({
          archived_at: null,
          departure_reason: null,
          departure_note: null,
          departure_place: null,
          next_watered_at: null,
          next_check_soil_at: todayStr,
          next_misted_at: freshCycle(plant.next_misted_at, plant.misting_interval_days),
          next_fertilized_at: freshCycle(plant.next_fertilized_at, plant.fertilizing_interval_days),
        })
        .eq('id', plant.id)
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
