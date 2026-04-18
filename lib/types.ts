export type PlantStatus = 'healthy' | 'needs_attention' | 'recovering'

export type LogType =
  | 'watering'
  | 'misting'
  | 'fertilizing'
  | 'repotting'
  | 'pruning'
  | 'issue_observed'

export interface Plant {
  id: string
  user_id: string
  name: string
  nickname: string | null
  species: string | null
  location: string | null
  acquisition_date: string | null
  notes: string | null
  status: PlantStatus
  photo_url: string | null
  // Watering
  last_watered_at: string | null
  next_watered_at: string | null
  watering_interval_days: number | null
  watering_source: string | null
  // Misting
  last_misted_at: string | null
  next_misted_at: string | null
  misting_interval_days: number | null
  misting_source: string | null
  // Fertilizing
  last_fertilized_at: string | null
  next_fertilized_at: string | null
  fertilizing_interval_days: number | null
  fertilizing_source: string | null
  // Repotting
  last_repotted_at: string | null
  // Pot info
  pot_type: string | null
  pot_diameter_cm: number | null
  pot_height_cm: number | null
  // Care profile
  light_requirement: string | null
  humidity_preference: string | null
  temperature_min: number | null
  temperature_max: number | null
  soil_type: string | null
  // Watering recommendation (generated once by Claude, cached)
  watering_recommendation: string | null
  watering_recommendation_updated_at: string | null
  // Meta
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface PlantLog {
  id: string
  plant_id: string
  user_id: string
  type: LogType
  date: string
  note: string | null
  photo_url: string | null
  issue_description: string | null
  created_at: string
  updated_at: string
}

export interface PlantWithLastLog extends Plant {
  last_log_date?: string | null
}

export interface UpcomingTask {
  key: string
  plant: Plant
  type: 'watering' | 'misting' | 'fertilizing'
  dueDate: string // YYYY-MM-DD
}

export type LocationType =
  | 'indoor_home'
  | 'greenhouse'
  | 'outdoor_garden'
  | 'balcony_patio'
  | 'office'
  | 'other'

export interface SiteLocation {
  id: string
  user_id: string
  name: string
  location_type: LocationType | null
  light_level: string | null  // low | medium | bright_indirect | direct
  humidity: string | null     // low | medium | high
  notes: string | null
  geo_city: string | null
  geo_country: string | null
  geo_lat: number | null
  geo_lng: number | null
  photo_urls: string[]
  created_at: string
  updated_at: string
}
