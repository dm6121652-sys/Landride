import { useEffect, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'
import { campusBounds, hasCampusBounds } from './lib/supabase'
import { loadGoogleMaps } from './lib/googleMaps'
import { supabase } from './lib/supabase'

type MapState = 'loading' | 'key-missing' | 'map-error'
const googleKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? ''

export default function CampusMap() {
  const host = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<MapState>('loading')
  const [error, setError] = useState('')
  const [liveCount, setLiveCount] = useState(0)
  const [liveChecked, setLiveChecked] = useState(false)
  const [liveError, setLiveError] = useState(false)

  useEffect(() => {
    if (!hasCampusBounds) return
    if (!googleKey) { setState('key-missing'); return }
    if (!host.current) return

    let disposed = false
    let map: any
    let locationChannel: ReturnType<NonNullable<typeof supabase>['channel']> | undefined
    let refreshTimer = 0
    const markers = new Map<string, any>()
    const bounds = { north: campusBounds.north, south: campusBounds.south, east: campusBounds.east, west: campusBounds.west }
    void (async () => {
      try {
        await loadGoogleMaps(googleKey)
        const [{ Map }, { AdvancedMarkerElement }] = await Promise.all([
          (window as any).google.maps.importLibrary('maps'),
          (window as any).google.maps.importLibrary('marker'),
        ])
        if (disposed || !host.current) return
        map = new Map(host.current, {
          center: { lat: (bounds.north + bounds.south) / 2, lng: (bounds.east + bounds.west) / 2 },
          zoom: 15, minZoom: 15, maxZoom: 19,
          restriction: { latLngBounds: bounds, strictBounds: true },
          mapId: 'DEMO_MAP_ID',
          mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
          clickableIcons: false, gestureHandling: 'greedy',
        })

        const refreshDrivers = async () => {
          if (!supabase || disposed) { setLiveChecked(true); return }
          const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString()
          const { data, error: locationsError } = await supabase.from('driver_locations')
            .select('driver_id,lat,lng,updated_at,online').eq('online', true).gte('updated_at', cutoff)
          if (disposed) return
          if (locationsError) { setLiveError(true); setLiveChecked(true); return }
          setLiveError(false)
          const liveIds = new Set<string>()
          for (const driver of data ?? []) {
            liveIds.add(driver.driver_id)
            const position = { lat: Number(driver.lat), lng: Number(driver.lng) }
            const existing = markers.get(driver.driver_id)
            if (existing) existing.position = position
            else {
              const pin = document.createElement('div')
              pin.className = 'live-driver-marker'
              pin.setAttribute('aria-label', 'Live Landride shuttle')
              pin.innerHTML = '<span>🚌</span>'
              markers.set(driver.driver_id, new AdvancedMarkerElement({ map, position, content: pin, title: 'Landride shuttle online', anchorLeft: '-50%', anchorTop: '-100%' }))
            }
          }
          for (const [driverId, marker] of markers) {
            if (!liveIds.has(driverId)) { marker.map = null; markers.delete(driverId) }
          }
          setLiveCount(liveIds.size)
          setLiveChecked(true)
        }

        void refreshDrivers()
        if (supabase) {
          locationChannel = supabase.channel('campus-live-driver-locations')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_locations' }, () => { void refreshDrivers() })
            .subscribe()
        }
        refreshTimer = window.setInterval(() => { void refreshDrivers() }, 30000)
      } catch (cause) {
        if (!disposed) { setError(cause instanceof Error ? cause.message : 'Google Maps failed to load.'); setState('map-error') }
      }
    })()

    return () => {
      disposed = true
      window.clearInterval(refreshTimer)
      if (locationChannel && supabase) void supabase.removeChannel(locationChannel)
      for (const marker of markers.values()) marker.map = null
    }
  }, [])

  return <section className="map-card">
    {!hasCampusBounds || state === 'key-missing' || state === 'map-error' ? <div className="map-unconfigured"><div className="map-note-icon"><MapPin size={18}/></div><strong>{state === 'key-missing' ? 'Add a Google Maps key' : state === 'map-error' ? 'Google Maps needs attention' : 'Campus bounds are missing'}</strong><span>{state === 'key-missing' ? 'Google Maps requires a Maps Platform key. Save it in .env.local and restart the app to show the campus.' : state === 'map-error' ? error : 'Add the southwest and northeast coordinates to .env.local, then restart Vite.'}</span></div> : <div className="map-canvas"><div className="google-map-host" ref={host}/><div className="map-live-status" aria-live="polite"><i className={liveError ? 'is-error' : liveCount ? 'is-live' : ''}/>{liveError ? 'Shuttle locations unavailable' : liveChecked ? `${liveCount} live ${liveCount === 1 ? 'shuttle' : 'shuttles'}` : 'Checking live shuttles…'}</div></div>}
  </section>
}
