'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function usePhotoUpload() {
  const [uploading, setUploading] = useState(false)

  async function uploadPhoto(file: File, folder: 'plants' | 'logs'): Promise<string> {
    setUploading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const ext = file.name.split('.').pop()
    const path = `${user.id}/${folder}/${Date.now()}.${ext}`

    const { error } = await supabase.storage
      .from('plant-photos')
      .upload(path, file, { upsert: true })

    setUploading(false)
    if (error) throw error

    const { data } = supabase.storage.from('plant-photos').getPublicUrl(path)
    return data.publicUrl
  }

  async function deletePhoto(url: string) {
    const supabase = createClient()
    const path = url.split('/plant-photos/')[1]
    if (!path) return
    await supabase.storage.from('plant-photos').remove([path])
  }

  return { uploadPhoto, deletePhoto, uploading }
}
