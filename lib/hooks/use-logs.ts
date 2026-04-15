import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { addDays, parseISO, format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import type { PlantLog } from '@/lib/types'

type CreateLogInput = Omit<PlantLog, 'id' | 'user_id' | 'created_at' | 'updated_at'> & {
  wateringIntervalDays?: number | null
  mistingIntervalDays?: number | null
  fertilizingIntervalDays?: number | null
}

export function useLogs(plantId: string) {
  return useQuery({
    queryKey: ['logs', plantId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('plant_logs')
        .select('*')
        .eq('plant_id', plantId)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as PlantLog[]
    },
  })
}

export function useLog(id: string) {
  return useQuery({
    queryKey: ['log', id],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('plant_logs')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as PlantLog
    },
  })
}

function nextDate(fromDate: string, intervalDays: number): string {
  return format(addDays(parseISO(fromDate), intervalDays), 'yyyy-MM-dd')
}

export function useCreateLog() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (values: CreateLogInput) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { wateringIntervalDays, mistingIntervalDays, fertilizingIntervalDays, ...logValues } =
        values
      const { data, error } = await supabase
        .from('plant_logs')
        .insert({ ...logValues, user_id: user.id })
        .select()
        .single()
      if (error) throw error

      // Auto-update plant care dates
      const plantUpdate: Record<string, string> = {}

      if (values.type === 'watering') {
        plantUpdate.last_watered_at = values.date
        if (wateringIntervalDays) {
          plantUpdate.next_watered_at = nextDate(values.date, wateringIntervalDays)
        }
      } else if (values.type === 'misting') {
        plantUpdate.last_misted_at = values.date
        if (mistingIntervalDays) {
          plantUpdate.next_misted_at = nextDate(values.date, mistingIntervalDays)
        }
      } else if (values.type === 'fertilizing') {
        plantUpdate.last_fertilized_at = values.date
        if (fertilizingIntervalDays) {
          plantUpdate.next_fertilized_at = nextDate(values.date, fertilizingIntervalDays)
        }
      }

      if (Object.keys(plantUpdate).length > 0) {
        await supabase.from('plants').update(plantUpdate).eq('id', values.plant_id)
      }

      return data as PlantLog
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['logs', variables.plant_id] })
      queryClient.invalidateQueries({ queryKey: ['plants'] })
      queryClient.invalidateQueries({ queryKey: ['plants', variables.plant_id] })
    },
  })
}

export function useUpdateLog(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (
      values: Partial<Omit<PlantLog, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
    ) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('plant_logs')
        .update(values)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as PlantLog
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['logs', data.plant_id] })
      queryClient.invalidateQueries({ queryKey: ['log', id] })
    },
  })
}

export function useDeleteLog() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, plantId }: { id: string; plantId: string }) => {
      const supabase = createClient()
      const { error } = await supabase.from('plant_logs').delete().eq('id', id)
      if (error) throw error
      return plantId
    },
    onSuccess: (plantId) => {
      queryClient.invalidateQueries({ queryKey: ['logs', plantId] })
      queryClient.invalidateQueries({ queryKey: ['plants'] })
    },
  })
}
