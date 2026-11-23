import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export const supabaseConfigured = Boolean(url && anonKey)
export const supabase = supabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      realtime: { params: { eventsPerSecond: 5 } },
    })
  : null

export const campusBounds = {
  south: Number(import.meta.env.VITE_CAMPUS_SW_LAT),
  west: Number(import.meta.env.VITE_CAMPUS_SW_LNG),
  north: Number(import.meta.env.VITE_CAMPUS_NE_LAT),
  east: Number(import.meta.env.VITE_CAMPUS_NE_LNG),
}

export const hasCampusBounds = Object.values(campusBounds).every(Number.isFinite)
  && campusBounds.south < campusBounds.north
  && campusBounds.west < campusBounds.east
