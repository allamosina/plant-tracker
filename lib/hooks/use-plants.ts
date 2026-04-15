import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { parseISO, isBefore, startOfToday } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import type { Plant, UpcomingTask } from '@/lib/types'

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
