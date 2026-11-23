import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { ArrowRight, ArrowUpRight, BusFront, CalendarDays, Check, CircleHelp, Clock3, LayoutDashboard, LogOut, MapPin, Plus, Search, WalletCards, History, X } from 'lucide-react'
import Brand from './Brand'
import CampusMap from './CampusMap'
import ThemeToggle from './ThemeToggle'
import WalletPanel from './WalletPanel'
import { supabase } from './lib/supabase'

type Stop = { id: string; name: string; lat: number; lng: number }
type AvailableTrip = { trip_id: string; vehicle_id: string; vehicle_name: string; seats_total: number; seats_available: number; fare_per_seat: number | null; solo_fare: number | null; departs_at: string | null; status: string }
type Booking = {
  id: string; seats: number; status: string; sharing_ok: boolean; created_at: string;
  trip: { status: string; departs_at: string | null; vehicle: { name: string } | null } | null;
  pickup: { name: string } | null;
  dropoff: { name: string } | null;
}

const historyStatuses = new Set(['completed', 'cancelled', 'no_show'])
const bookingStatus: Record<string, string> = { pending: 'Waiting for driver', confirmed: 'Confirmed', picked_up: 'On your way', completed: 'Completed', cancelled: 'Cancelled', no_show: 'No-show' }
const niceTime = (value: string | null) => value ? new Date(value).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : 'On demand'
const naira = (value: number | null) => value == null ? 'Fare set by driver' : `₦${Number(value).toLocaleString()}`

export default function StudentApp({ displayName, matricNumber, darkMode, onToggleTheme, session }: { displayName: string; matricNumber: string; darkMode: boolean; onToggleTheme: () => void; session: Session }) {
  const [active, setActive] = useState<'Overview' | 'My rides' | 'Ride history' | 'Wallet'>('Overview')
  const [notice, setNotice] = useState('')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [ridesLoading, setRidesLoading] = useState(true)
  const [ridesError, setRidesError] = useState('')
  const [stops, setStops] = useState<Stop[]>([])
  const [stopsError, setStopsError] = useState('')
  const [pickup, setPickup] = useState('')
  const [dropoff, setDropoff] = useState('')
  const [seats, setSeats] = useState(1)
  const [sharing, setSharing] = useState(true)
  const [trips, setTrips] = useState<AvailableTrip[]>([])
  const [selectedTrip, setSelectedTrip] = useState('')
  const [tripsLoading, setTripsLoading] = useState(false)
  const [shuttleDialogOpen, setShuttleDialogOpen] = useState(false)
  const [requestBusy, setRequestBusy] = useState(false)
  const [requestError, setRequestError] = useState('')
  const [searchError, setSearchError] = useState('')
  const [searchHint, setSearchHint] = useState('')
  const [, setOnline] = useState(navigator.onLine)

  const refreshBookings = useCallback(async () => {
    if (!supabase) return
    setRidesLoading(true)
    const { data, error } = await supabase.from('bookings')
      .select('id,seats,status,sharing_ok,created_at,trip:trips(status,departs_at,vehicle:vehicles(name)),pickup:stops!bookings_pickup_stop_fkey(name),dropoff:stops!bookings_dropoff_stop_fkey(name)')
      .eq('student_id', session.user.id).order('created_at', { ascending: false })
    if (error) setRidesError(error.message)
    else { setBookings((data ?? []) as unknown as Booking[]); setRidesError('') }
    setRidesLoading(false)
  }, [session.user.id])

  useEffect(() => { void refreshBookings() }, [refreshBookings])
  useEffect(() => {
    const client = supabase
    if (!client) return
    let alive = true
    void client.from('stops').select('id,name,lat,lng').eq('enabled', true).order('name')
      .then(({ data, error }) => { if (alive) { if (error) setStopsError(error.message); else setStops((data ?? []) as Stop[]) } })
    const channel = client.channel(`student-rides-${session.user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `student_id=eq.${session.user.id}` }, () => { void refreshBookings() })
      .subscribe()
    const onOnline = () => { setOnline(true); void refreshBookings() }
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline); window.addEventListener('offline', onOffline)
    return () => { alive = false; window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); void client.removeChannel(channel) }
  }, [refreshBookings, session.user.id])

  const upcoming = useMemo(() => bookings.filter(item => !historyStatuses.has(item.status)), [bookings])
  const history = useMemo(() => bookings.filter(item => historyStatuses.has(item.status)), [bookings])
  const activeBooking = upcoming.find(item => item.status === 'confirmed' || item.status === 'picked_up')
  const firstName = displayName.split(/[ @]/)[0] || 'Student'

  function openRequest() {
    setActive('Overview'); setRequestError('')
    window.setTimeout(() => document.querySelector('#request-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0)
  }

  async function searchShuttles() {
    if (!supabase) { setRequestError('Shuttle search is unavailable. Check the Supabase connection.'); return }
    if (!pickup || !dropoff) { setRequestError('Choose a pickup stop and destination first.'); return }
    if (pickup === dropoff) { setRequestError('Pickup and destination must be different stops.'); return }
    setRequestError(''); setSearchError(''); setSearchHint(''); setTrips([]); setSelectedTrip(''); setTripsLoading(true); setShuttleDialogOpen(true)
    const { data, error } = await supabase.rpc('available_trips', { p_seats: sharing ? seats : 1 })
    if (error) { setSearchError(error.message); setTrips([]) }
    else {
      const available = ((data ?? []) as AvailableTrip[]).filter(trip => sharing || trip.seats_available === trip.seats_total)
      setTrips(available)
      if (!available.length) {
        const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString()
        const { data: locations, error: locationError } = await supabase.from('driver_locations')
          .select('driver_id').eq('online', true).gte('updated_at', cutoff)
        if (locationError || !locations?.length) {
          setSearchHint('No driver has sent a fresh location recently. Ask the driver to open Landride Driver, go offline, then go online again.')
        } else {
          const driverIds = locations.map(location => location.driver_id)
          const { data: vehicles, error: vehicleError } = await supabase.from('vehicles')
            .select('id').eq('enabled', true).in('driver_id', driverIds)
          if (vehicleError || !vehicles?.length) {
            setSearchHint('A driver is live, but no enabled shuttle is assigned to that driver. Ask the Landride owner to check the vehicle assignment.')
          } else {
            const vehicleIds = vehicles.map(vehicle => vehicle.id)
            const { data: trips, error: tripError } = await supabase.from('trips')
              .select('id,status,departs_at').in('vehicle_id', vehicleIds).in('status', ['scheduled', 'active'])
            const now = Date.now()
            const openTrips = (trips ?? []).filter(trip => !trip.departs_at || new Date(trip.departs_at).getTime() >= now)
            setSearchHint(tripError || !openTrips.length
              ? 'The driver is live, but their app has not opened a current shuttle trip. Update the driver app, then switch offline and online again.'
              : sharing
                ? 'A trip is open, but it has no seats left for this request. Try fewer seats or ask the driver to check current bookings.'
                : 'A trip is open, but it is not empty for a private ride. Turn on sharing or ask the driver to check current bookings.')
          }
        }
      }
    }
    setTripsLoading(false)
  }

  async function requestBooking() {
    if (!supabase || !selectedTrip || !pickup || !dropoff) { setRequestError('Choose a pickup stop, destination, and available shuttle.'); return }
    if (pickup === dropoff) { setRequestError('Pickup and destination must be different stops.'); return }
    setRequestBusy(true); setRequestError('')
    const selected = trips.find(trip => trip.trip_id === selectedTrip)
    const { error } = await supabase.rpc('request_booking', {
      p_trip_id: selectedTrip,
      p_seats: sharing ? seats : selected?.seats_total ?? seats,
      p_pickup_stop: pickup,
      p_dropoff_stop: dropoff,
      p_sharing_ok: sharing,
    })
    setRequestBusy(false)
    if (error) { setRequestError(error.message); return }
    setShuttleDialogOpen(false); setActive('My rides'); setNotice("Ride request sent. You'll see the driver's response in My rides.")
    await refreshBookings()
  }

  async function cancelBooking(id: string) {
    if (!supabase) return
    const { error } = await supabase.rpc('cancel_booking', { p_booking_id: id })
    if (error) setNotice(error.message)
    else { setNotice('Ride cancelled.'); await refreshBookings() }
  }

  async function signOut() { await supabase?.auth.signOut() }

  const subtitleMap: Record<typeof active, string> = {
    Overview: 'Choose your stops and find your next campus ride.',
    'My rides': 'Your upcoming requests and confirmed campus rides.',
    'Ride history': 'Your completed and cancelled rides.',
    Wallet: 'Manage your Landride wallet and transaction history.',
  }

  const dashboardTabs = [
    { label: 'Overview' as const, icon: LayoutDashboard },
    { label: 'My rides' as const, icon: BusFront },
    { label: 'Ride history' as const, icon: History },
    { label: 'Wallet' as const, icon: WalletCards },
  ]

  return <div className="rider-dashboard">
    <header className="dash-header"><div className="dash-header-inner"><Brand/><div className="dash-header-actions"><ThemeToggle darkMode={darkMode} onToggle={onToggleTheme}/><button className="icon-help" title="Get support" onClick={() => setNotice('Please contact your campus shuttle coordinator for pilot support.')}><CircleHelp size={18}/></button><button className="button button-outline dash-signout" onClick={signOut}><span>Sign out</span><LogOut size={15}/></button></div></div></header>

    <div className="dashboard-shell">
      <aside className="dash-sidebar"><span className="dash-sidebar-label">YOUR CAMPUS</span><nav className="dash-nav" aria-label="Student dashboard">{dashboardTabs.map(({ label, icon: Icon }) => <button key={label} className={active === label ? 'dash-nav-active' : ''} aria-current={active === label ? 'page' : undefined} onClick={() => setActive(label)}><Icon size={18}/><span className="dash-nav-label">{label}</span>{label === 'My rides' && upcoming.length > 0 && <span className="dash-nav-count">{upcoming.length}</span>}</button>)}</nav><div className="dash-sidebar-note"><span>LANDRIDE</span><small>Campus journeys, together.</small></div></aside>
    <main className="public-wrap dash-main">
      {active === 'Overview' && <section className="dash-greeting"><div><h1>Hello, {firstName}.</h1><p>{matricNumber ? `Matric no. ${matricNumber} · ` : ''}{subtitleMap[active]}</p></div><div className="dash-metrics"><div className="metric-chip"><strong>{upcoming.length}</strong><span>Upcoming rides</span></div><div className="metric-chip metric-chip-soft"><strong>{activeBooking ? bookingStatus[activeBooking.status] : 'Ready when you are'}</strong><span>Next ride</span></div></div></section>}

      {active === 'Overview' ? <>
        <div className="reference-dashboard-grid">
          <section id="request-panel" className="reference-panel ride-request-panel">
            <div className="panel-heading"><div><span className="section-kicker">REQUEST A CAMPUS RIDE</span><h2>Where to?</h2></div><span className="panel-icon"><MapPin size={19}/></span></div>
            <label className="form-label" htmlFor="quick-pickup">Pickup</label>
            <select id="quick-pickup" className="form-select" value={pickup} onChange={event => setPickup(event.target.value)}><option value="">Choose a pickup stop</option>{stops.map(stop => <option value={stop.id} key={stop.id}>{stop.name}</option>)}</select>
            <label className="form-label" htmlFor="quick-destination">Destination</label>
            <select id="quick-destination" className="form-select" value={dropoff} onChange={event => setDropoff(event.target.value)}><option value="">Choose a destination</option>{stops.map(stop => <option value={stop.id} key={stop.id}>{stop.name}</option>)}</select>
            {stopsError ? <div className="dashboard-error">Couldn't load campus stops: {stopsError}</div> : !stops.length ? <div className="dashboard-hint">No enabled campus stops yet. Add locations to the Supabase `stops` table.</div> : null}
            <div className="ride-preferences"><div className="seat-picker"><span>Seats needed</span><div><button aria-label="Remove a seat" disabled={!sharing || seats <= 1} onClick={() => setSeats(value => Math.max(1, value - 1))}>−</button><strong>{seats}</strong><button aria-label="Add a seat" disabled={!sharing} onClick={() => setSeats(value => value + 1)}>+</button></div></div><label className="share-check"><input type="checkbox" checked={sharing} onChange={event => setSharing(event.target.checked)}/><span><Check size={12}/></span>Sharing is okay</label></div>
            {requestError && <div className="dashboard-error" role="alert">{requestError}</div>}
            <button className="button button-primary request-button" disabled={tripsLoading || !pickup || !dropoff || pickup === dropoff} onClick={searchShuttles}>{tripsLoading ? <>Searching shuttles…</> : <>Search for shuttles <Search size={17}/></>}</button>
          </section>
          <div className="dash-map-column"><section className="map-panel reference-panel"><div className="panel-heading map-panel-heading"><div><span className="section-kicker">CAMPUS MAP</span><h2>Campus map</h2></div><span className="map-caption"><MapPin size={15}/> Campus view</span></div><CampusMap/></section>
            <section className="driver-update-panel"><span className="driver-update-icon"><Clock3 size={18}/></span><div><strong>{activeBooking ? `Your ride is ${bookingStatus[activeBooking.status].toLowerCase()}` : 'Ready for your next ride'}</strong><p>{activeBooking ? `${activeBooking.pickup?.name ?? 'Pickup'} → ${activeBooking.dropoff?.name ?? 'Destination'}` : 'Choose a pickup and destination to see available shuttles.'}</p></div>{activeBooking && <button className="text-link" onClick={() => setActive('My rides')}>View ride <ArrowUpRight size={14}/></button>}</section>
          </div>
        </div>
        <section className="dashboard-rides-panel reference-panel"><div className="panel-heading"><div><span className="section-kicker">YOUR ACTIVITY</span><h2>Upcoming rides</h2></div><button className="text-link" onClick={() => setActive('My rides')}>View all <ArrowUpRight size={15}/></button></div>{ridesError ? <div className="dashboard-error">Couldn't load rides: {ridesError}</div> : ridesLoading ? <div className="rides-empty">Loading your rides…</div> : upcoming.length ? <RideList rows={upcoming.slice(0, 3)} history={false} onCancel={cancelBooking} onRequest={openRequest}/> : <div className="rides-empty"><CalendarDays size={22}/><strong>No rides booked yet</strong><span>Your ride requests will show up here.</span></div>}</section>
      </> : active === 'Wallet' ? <><section className="wallet-page-heading"><div><span>YOUR CAMPUS ACCOUNT</span><h1>Ride wallet</h1><p>Keep track of top-ups and spending for your campus rides.</p></div></section><WalletPanel session={session} /></> : <><section className="rides-page-heading"><span className="rides-page-icon">{active === 'My rides' ? <BusFront size={20}/> : <History size={20}/>}</span><div><span className="section-kicker">{active === 'My rides' ? 'YOUR JOURNEYS' : 'THE ROAD SO FAR'}</span><h1>{active === 'My rides' ? 'Ride plans' : 'Ride history'}</h1><p>{active === 'My rides' ? 'Requests and confirmed trips, all in one place.' : 'A record of the campus rides you have completed or cancelled.'}</p></div>{active === 'My rides' && <button className="button button-primary button-small" onClick={openRequest}><Plus size={15}/> Request a ride</button>}</section><section className="dashboard-rides-panel reference-panel rides-page"><div className="panel-heading"><div><h2>{active === 'My rides' ? 'Upcoming trips' : 'Past trips'}</h2><p>{active === 'My rides' ? 'The next legs of your campus day.' : 'Completed and cancelled campus rides.'}</p></div></div>{ridesError ? <div className="dashboard-error">Couldn't load rides: {ridesError}</div> : ridesLoading ? <div className="rides-empty">Loading your rides…</div> : <RideList rows={active === 'My rides' ? upcoming : history} history={active === 'Ride history'} onCancel={cancelBooking} onRequest={openRequest}/>}</section></>}

      <footer className="dash-footer"><span>Landride · Landmark University</span><span>Campus rides, thoughtfully connected</span></footer>
    </main></div>

    {shuttleDialogOpen && <div className="shuttle-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setShuttleDialogOpen(false) }}><section className="shuttle-dialog" role="dialog" aria-modal="true" aria-labelledby="shuttle-dialog-title"><div className="shuttle-dialog-head"><div><span className="section-kicker">CAMPUS SHUTTLES</span><h2 id="shuttle-dialog-title">Choose a shuttle</h2><p>{stops.find(stop => stop.id === pickup)?.name} <ArrowRight size={13}/> {stops.find(stop => stop.id === dropoff)?.name}</p></div><button className="shuttle-dialog-close" onClick={() => setShuttleDialogOpen(false)} aria-label="Close shuttle list"><X size={19}/></button></div>{tripsLoading ? <div className="shuttle-dialog-state"><span className="loading-spinner"/><strong>Searching available shuttles…</strong><small>Checking live drivers and open seats</small></div> : searchError ? <div className="choice-empty" role="alert">Couldn't search shuttles: {searchError}</div> : trips.length ? <><div className="shuttle-dialog-list">{trips.map(trip => <button key={trip.trip_id} className={`shuttle-choice ${selectedTrip === trip.trip_id ? 'shuttle-choice-selected' : ''}`} onClick={() => setSelectedTrip(trip.trip_id)}><span className="choice-icon"><BusFront size={20}/></span><span className="choice-copy"><strong>{trip.vehicle_name}</strong><small>{sharing ? `${trip.seats_available} of ${trip.seats_total} seats available` : 'Private ride'} · {niceTime(trip.departs_at)}</small></span><span className="choice-fare">{naira(sharing ? trip.fare_per_seat : trip.solo_fare)}</span>{selectedTrip === trip.trip_id && <Check className="shuttle-choice-check" size={17}/>}</button>)}</div>{requestError && <div className="dashboard-error" role="alert">{requestError}</div>}</> : <div className="shuttle-dialog-state"><span className="choice-icon"><BusFront size={20}/></span><strong>No bookable shuttles found</strong><small>{searchHint || 'No online shuttle currently has enough open seats for this search.'}</small><button className="text-link" onClick={() => void searchShuttles()}>Search again <ArrowRight size={14}/></button></div>}{!!trips.length && !tripsLoading && <button className="button button-primary shuttle-dialog-submit" disabled={!selectedTrip || requestBusy} onClick={requestBooking}>{requestBusy ? 'Sending request…' : <>Request selected shuttle <ArrowRight size={17}/></>}</button>}</section></div>}
    {notice && <div className="toast"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss"><X size={15}/></button></div>}
  </div>
}

function RideList({ rows, history, onCancel, onRequest }: { rows: Booking[]; history: boolean; onCancel: (id: string) => void; onRequest: () => void }) {
  if (!rows.length) return <div className="rides-empty"><CalendarDays size={23}/><strong>{history ? 'No past rides yet' : 'No upcoming rides'}</strong><span>{history ? 'Completed rides will appear here.' : 'Your ride requests and confirmed journeys will appear here.'}</span>{!history && <button className="button button-primary button-small" onClick={onRequest}><Plus size={15}/> Request a ride</button>}</div>
  return <div className="ride-list">{rows.map(item => <article className="ride-row-card" key={item.id}><div className="ride-date-icon"><CalendarDays size={18}/></div><div className="ride-row-main"><div className="ride-row-top"><strong>{item.pickup?.name ?? 'Campus stop'} <ArrowRight size={14}/> {item.dropoff?.name ?? 'Campus stop'}</strong><span className={`ride-status status-${item.status}`}>{bookingStatus[item.status] ?? item.status}</span></div><div className="ride-row-meta"><span>{item.trip?.vehicle?.name ?? 'Shuttle assignment pending'}</span><span>·</span><span>{item.seats} {item.seats === 1 ? 'seat' : 'seats'}</span><span>·</span><span>{niceTime(item.trip?.departs_at ?? null)}</span></div><div className="ride-row-meta muted-meta">Requested {new Date(item.created_at).toLocaleDateString([], { day: 'numeric', month: 'short' })}{item.sharing_ok ? ' · sharing okay' : ' · solo ride'}</div></div>{!history && ['pending','confirmed'].includes(item.status) && <button className="cancel-ride" onClick={() => onCancel(item.id)}>Cancel ride</button>}</article>)}</div>
}
