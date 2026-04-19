import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, addDays, parseISO } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { computeSmartWateringInterval, computeSmartFertilizingInterval, computePostRepotWateringDelay } from '@/lib/utils/smart-interval'
import type { Plant, SiteLocation } from '@/lib/types'

export function useSiteLocations() {
  return useQuery({
    queryKey: ['site-locations'],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .order('name')
      if (error) throw error
      return data as SiteLocation[]
    },
  })
}

export function useSiteLocation(name: string) {
  return useQuery({
    queryKey: ['site-locations', name],
    enabled: !!name,
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('name', name)
        .maybeSingle()
      if (error) throw error
      return data as SiteLocation | null
    },
  })
}

export function useUpsertLocation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (
      values: Partial<Omit<SiteLocation, 'id' | 'user_id' | 'created_at' | 'updated_at'>> & { name: string }
    ) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { data, error } = await supabase
        .from('locations')
        .upsert(
          { ...values, user_id: user.id, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,name' }
        )
        .select()
        .single()
      if (error) throw error
      return data as SiteLocation
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['site-locations'] })
      queryClient.invalidateQueries({ queryKey: ['site-locations', data.name] })
    },
  })
}

export function useReschedulePlantsAtLocation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ locationName, geoLat }: { locationName: string; geoLat: number | null }) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { data: plants } = await supabase
        .from('plants')
        .select('*')
        .eq('location', locationName)
        .eq('user_id', user.id)
      if (!plants?.length) return
      for (const plant of plants) {
        const smart = computeSmartWateringInterval(plant as Plant, geoLat)
        const fertResult = computeSmartFertilizingInterval(plant as Plant, geoLat)
        const smartFert = fertResult && !fertResult.suspended ? fertResult.days : null
        const update: Record<string, string | null> = {
          watering_recommendation: null,
          watering_recommendation_updated_at: null,
        }
        let nextWatered: string | null = null
        if (plant.last_watered_at && smart) {
          nextWatered = format(addDays(parseISO(plant.last_watered_at), smart), 'yyyy-MM-dd')
        }
        const postRepotDelay = computePostRepotWateringDelay(plant as Plant)
        if (postRepotDelay !== null && plant.last_repotted_at) {
          const repotBased = format(addDays(parseISO(plant.last_repotted_at), postRepotDelay), 'yyyy-MM-dd')
          if (!nextWatered || repotBased > nextWatered) nextWatered = repotBased
        }
        if (nextWatered) update.next_watered_at = nextWatered
        if (plant.last_fertilized_at && smartFert) {
          update.next_fertilized_at = format(addDays(parseISO(plant.last_fertilized_at), smartFert), 'yyyy-MM-dd')
        }
        await supabase.from('plants').update(update).eq('id', plant.id)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plants'] })
      queryClient.invalidateQueries({ queryKey: ['upcoming-tasks'] })
    },
  })
}

export function useDeleteSiteLocation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      // Clear location from all plants at this site
      await supabase
        .from('plants')
        .update({ location: null })
        .eq('location', name)
        .eq('user_id', user.id)
      // Delete the location record if it exists
      await supabase
        .from('locations')
        .delete()
        .eq('name', name)
        .eq('user_id', user.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-locations'] })
      queryClient.invalidateQueries({ queryKey: ['plants'] })
    },
  })
}
