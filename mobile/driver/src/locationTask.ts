import * as TaskManager from 'expo-task-manager'
import type * as Location from 'expo-location'
import { supabase } from './supabase'

export const LOCATION_TASK = 'LANDRIDE_BACKGROUND_LOCATION'

TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error || !data) return
  const locations = (data as { locations: Location.LocationObject[] }).locations
  const latest = locations[locations.length - 1]
  if (!latest) return

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('driver_locations').upsert({
    driver_id: user.id,
    lat: latest.coords.latitude,
    lng: latest.coords.longitude,
    updated_at: new Date(latest.timestamp).toISOString(),
    online: true,
  })
})
