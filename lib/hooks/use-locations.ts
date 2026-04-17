import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { SiteLocation } from '@/lib/types'

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
