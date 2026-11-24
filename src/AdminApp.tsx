import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Activity, BusFront, Check, LayoutDashboard, LogOut, MapPin, Plus, RefreshCw, Shield, Trash2, Users } from 'lucide-react'
import Brand from './Brand'
import ThemeToggle from './ThemeToggle'
import { supabase } from './lib/supabase'

type Profile = { id: string; display_name: string | null; matric_number: string | null; role: string }
type Vehicle = { id: string; name: string; driver_id: string | null; seats_total: number; enabled: boolean }
type Stop = { id: string; name: string; lat: number; lng: number; enabled: boolean }
type Trip = { id: string; status: string; departs_at: string | null; vehicle: { name: string } | null }
type Fee = { id: string; amount: number; booking_id: string; collected_at: string }

export default function AdminApp({ displayName, darkMode, onToggleTheme, session }: { displayName: string; darkMode: boolean; onToggleTheme: () => void; session: Session }) {
  const [tab, setTab] = useState<'Overview' | 'Drivers & shuttles' | 'Campus stops' | 'Trips'>('Overview')
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [stops, setStops] = useState<Stop[]>([])
  const [trips, setTrips] = useState<Trip[]>([])
  const [fees, setFees] = useState<Fee[]>([])
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [stopName, setStopName] = useState('')
  const [stopLat, setStopLat] = useState('')
  const [stopLng, setStopLng] = useState('')
  const [vehicleName, setVehicleName] = useState('')
  const [vehicleSeats, setVehicleSeats] = useState('4')
  const [vehicleDriver, setVehicleDriver] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    const [p, v, s, t, f] = await Promise.all([
      supabase.from('profiles').select('id,display_name,matric_number,role').order('display_name'),
      supabase.from('vehicles').select('id,name,driver_id,seats_total,enabled').order('name'),
      supabase.from('stops').select('id,name,lat,lng,enabled').order('name'),
      supabase.from('trips').select('id,status,departs_at,vehicle:vehicles(name)').order('created_at', { ascending: false }).limit(30),
      supabase.from('service_fee_ledger').select('id,amount,booking_id,collected_at').order('collected_at', { ascending: false }).limit(100),
    ])
    const errors = [p.error, v.error, s.error, t.error, f.error].filter(Boolean)
    setNotice(errors.length ? errors.map(error => error?.message).join(' · ') : '')
    setProfiles((p.data ?? []) as Profile[]); setVehicles((v.data ?? []) as Vehicle[]); setStops((s.data ?? []) as Stop[]); setTrips((t.data ?? []) as unknown as Trip[]); setFees((f.data ?? []) as Fee[])
    setLoading(false)
  }, [])
  useEffect(() => { void refresh() }, [refresh])

  async function addStop() {
    if (!supabase || !stopName.trim() || !Number.isFinite(Number(stopLat)) || !Number.isFinite(Number(stopLng))) return
    setBusy(true); const { error } = await supabase.from('stops').insert({ name: stopName.trim(), lat: Number(stopLat), lng: Number(stopLng), enabled: true })
    setBusy(false); setNotice(error?.message ?? 'Campus stop added.'); if (!error) { setStopName(''); setStopLat(''); setStopLng(''); await refresh() }
  }
  async function toggleStop(stop: Stop) {
    if (!supabase) return
    const { error } = await supabase.from('stops').update({ enabled: !stop.enabled }).eq('id', stop.id)
    setNotice(error?.message ?? `${stop.name} ${stop.enabled ? 'disabled' : 'enabled'}.`); if (!error) await refresh()
  }
  async function removeStop(stop: Stop) {
    if (!supabase || !confirm(`Delete ${stop.name}? Stops used in rides may be protected.`)) return
    const { error } = await supabase.from('stops').delete().eq('id', stop.id)
    setNotice(error?.message ?? 'Stop deleted.'); if (!error) await refresh()
  }
  async function addVehicle() {
    if (!supabase || !vehicleName.trim() || !vehicleDriver || Number(vehicleSeats) < 1) return
    setBusy(true); const { error } = await supabase.from('vehicles').insert({ name: vehicleName.trim(), seats_total: Number(vehicleSeats), driver_id: vehicleDriver, enabled: true })
    setBusy(false); setNotice(error?.message ?? 'Shuttle assigned.'); if (!error) { setVehicleName(''); setVehicleDriver(''); await refresh() }
  }
  async function updateVehicle(vehicle: Vehicle, patch: Partial<Vehicle>) {
    if (!supabase) return
    const { error } = await supabase.from('vehicles').update(patch).eq('id', vehicle.id)
    setNotice(error?.message ?? 'Shuttle updated.'); if (!error) await refresh()
  }
  async function updateTrip(trip: Trip, status: string) {
    if (!supabase) return
    const { error } = await supabase.from('trips').update({ status }).eq('id', trip.id)
    setNotice(error?.message ?? 'Trip status updated.'); if (!error) await refresh()
  }
  async function signOut() { await supabase?.auth.signOut() }

  const drivers = profiles.filter(profile => profile.role === 'driver')
  const students = profiles.filter(profile => profile.role === 'student')
  const tabs = [
    { name: 'Overview' as const, icon: LayoutDashboard }, { name: 'Drivers & shuttles' as const, icon: BusFront },
    { name: 'Campus stops' as const, icon: MapPin }, { name: 'Trips' as const, icon: Activity },
  ]
  return <div className="admin-app">
    <header className="admin-header"><Brand/><span className="admin-badge"><Shield size={14}/> Admin</span><div className="admin-header-actions"><ThemeToggle darkMode={darkMode} onToggle={onToggleTheme}/><button className="button button-outline admin-logout" onClick={signOut}><span>Sign out</span><LogOut size={15}/></button></div></header>
    <div className="admin-layout"><aside className="admin-sidebar"><small>OPERATIONS</small><nav>{tabs.map(({ name, icon: Icon }) => <button key={name} className={tab === name ? 'selected' : ''} onClick={() => setTab(name)}><Icon size={17}/>{name}</button>)}</nav><div className="admin-user"><Users size={17}/><span>{displayName || session.user.email}</span></div></aside>
      <main className="admin-main"><div className="admin-page-top"><div><span className="section-kicker">LANDRIDE OPERATIONS</span><h1>{tab === 'Overview' ? 'Control room' : tab}</h1><p>Manage the campus ride service from one place.</p></div><button className="button button-outline" onClick={() => void refresh()}><RefreshCw size={15}/> Refresh</button></div>
        {!!notice && <div className="admin-notice" role="status">{notice}<button onClick={() => setNotice('')}>Dismiss</button></div>}
        {loading ? <div className="admin-empty">Loading operations data…</div> : tab === 'Overview' ? <>
          <div className="admin-revenue"><div><span>YOUR SERVICE FEE EARNINGS</span><strong>₦{fees.reduce((sum, fee) => sum + Number(fee.amount), 0).toLocaleString()}</strong><small>{fees.length} verified paid {fees.length === 1 ? 'ride' : 'rides'} · ₦50 per ride</small></div><div className="admin-revenue-mark">₦</div></div>
          <div className="admin-stats"><article><span>Students</span><strong>{students.length}</strong><small>Registered campus riders</small></article><article><span>Drivers</span><strong>{drivers.length}</strong><small>Driver accounts</small></article><article><span>Shuttles</span><strong>{vehicles.filter(v => v.enabled).length}</strong><small>Enabled vehicles</small></article><article><span>Campus stops</span><strong>{stops.filter(s => s.enabled).length}</strong><small>Available for booking</small></article></div>
          <div className="admin-overview-grid"><section className="admin-card"><div className="admin-card-head"><div><span>FLEET</span><h2>Driver assignments</h2></div><button className="admin-inline-link" onClick={() => setTab('Drivers & shuttles')}>Manage fleet</button></div>{vehicles.slice(0,5).map(vehicle => <div className="admin-list-row" key={vehicle.id}><BusFront size={17}/><div><strong>{vehicle.name}</strong><small>{profiles.find(p => p.id === vehicle.driver_id)?.display_name || 'No driver assigned'} · {vehicle.seats_total} seats</small></div><i className={vehicle.enabled ? 'is-on' : ''}/></div>)}</section><section className="admin-card"><div className="admin-card-head"><div><span>RECENT SERVICE</span><h2>Latest trips</h2></div><button className="admin-inline-link" onClick={() => setTab('Trips')}>View all</button></div>{trips.slice(0,5).map(trip => <div className="admin-list-row" key={trip.id}><Activity size={16}/><div><strong>{trip.vehicle?.name || 'Shuttle'} · {trip.status}</strong><small>{trip.departs_at ? new Date(trip.departs_at).toLocaleString() : 'On demand'}</small></div></div>)}</section><section className="admin-card admin-wide"><div className="admin-card-head"><div><span>PAYMENTS</span><h2>Recent service fees</h2></div></div>{fees.slice(0,8).map(fee => <div className="admin-list-row" key={fee.id}><Check size={16}/><div><strong>Paid ride service fee</strong><small>{new Date(fee.collected_at).toLocaleString()} · ride {fee.booking_id.slice(0,8)}</small></div><b>₦{Number(fee.amount).toLocaleString()}</b></div>)}{fees.length === 0 && <div className="admin-empty">No fees collected yet. Revenue will appear after verified ride payments.</div>}</section></div>
        </> : tab === 'Drivers & shuttles' ? <div className="admin-two-col"><section className="admin-card"><div className="admin-card-head"><div><span>FLEET SETUP</span><h2>Assign a shuttle</h2></div></div><div className="admin-form"><label>Shuttle name<input value={vehicleName} onChange={e => setVehicleName(e.target.value)} placeholder="Campus Shuttle 01"/></label><label>Seats<input type="number" min="1" value={vehicleSeats} onChange={e => setVehicleSeats(e.target.value)}/></label><label>Driver account<select value={vehicleDriver} onChange={e => setVehicleDriver(e.target.value)}><option value="">Choose driver</option>{drivers.map(driver => <option key={driver.id} value={driver.id}>{driver.display_name || driver.id.slice(0,8)}</option>)}</select></label><button className="button button-primary" disabled={busy || !vehicleName.trim() || !vehicleDriver} onClick={() => void addVehicle()}><Plus size={16}/> Assign shuttle</button></div></section><section className="admin-card"><div className="admin-card-head"><div><span>DRIVER ACCOUNTS</span><h2>{drivers.length} drivers</h2></div></div>{drivers.map(driver => <div className="admin-list-row" key={driver.id}><Users size={16}/><div><strong>{driver.display_name || 'Driver'}</strong><small>{vehicles.find(v => v.driver_id === driver.id)?.name || 'No shuttle assigned'}</small></div></div>)}</section><section className="admin-card admin-wide"><div className="admin-card-head"><div><span>VEHICLES</span><h2>Shuttle fleet</h2></div></div>{vehicles.map(vehicle => <div className="admin-list-row" key={vehicle.id}><BusFront size={17}/><div><strong>{vehicle.name}</strong><small>{profiles.find(p => p.id === vehicle.driver_id)?.display_name || 'Unassigned'} · {vehicle.seats_total} seats</small></div><button className={`admin-toggle ${vehicle.enabled ? 'enabled' : ''}`} onClick={() => void updateVehicle(vehicle, { enabled: !vehicle.enabled })}>{vehicle.enabled ? 'Enabled' : 'Disabled'}</button></div>)}</section></div> : tab === 'Campus stops' ? <div className="admin-two-col"><section className="admin-card"><div className="admin-card-head"><div><span>NEW LOCATION</span><h2>Add campus stop</h2></div></div><div className="admin-form"><label>Stop name<input value={stopName} onChange={e => setStopName(e.target.value)} placeholder="Main Academic Block"/></label><div className="admin-coordinates"><label>Latitude<input inputMode="decimal" value={stopLat} onChange={e => setStopLat(e.target.value)} placeholder="8.12"/></label><label>Longitude<input inputMode="decimal" value={stopLng} onChange={e => setStopLng(e.target.value)} placeholder="5.09"/></label></div><button className="button button-primary" disabled={busy || !stopName.trim() || !stopLat || !stopLng} onClick={() => void addStop()}><Plus size={16}/> Add stop</button></div></section><section className="admin-card"><div className="admin-card-head"><div><span>BOOKING LOCATIONS</span><h2>{stops.length} stops</h2></div></div>{stops.map(stop => <div className="admin-list-row" key={stop.id}><MapPin size={17}/><div><strong>{stop.name}</strong><small>{stop.lat.toFixed(5)}, {stop.lng.toFixed(5)}</small></div><button className={`admin-toggle ${stop.enabled ? 'enabled' : ''}`} onClick={() => void toggleStop(stop)}>{stop.enabled ? 'Active' : 'Hidden'}</button><button className="admin-icon-danger" onClick={() => void removeStop(stop)} aria-label={`Delete ${stop.name}`}><Trash2 size={15}/></button></div>)}</section></div> : <section className="admin-card"><div className="admin-card-head"><div><span>TRIP OVERSIGHT</span><h2>Recent shuttle trips</h2></div></div>{trips.length ? trips.map(trip => <div className="admin-list-row" key={trip.id}><Activity size={17}/><div><strong>{trip.vehicle?.name || 'Shuttle'} · {trip.status}</strong><small>{trip.departs_at ? new Date(trip.departs_at).toLocaleString() : 'On demand'} · {trip.id.slice(0,8)}</small></div>{['scheduled','active'].includes(trip.status) && <select className="admin-status-select" value={trip.status} onChange={e => void updateTrip(trip,e.target.value)}><option value="scheduled">Scheduled</option><option value="active">Active</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select>}</div>) : <div className="admin-empty">No trips have been opened yet.</div>}</section>}
      </main>
    </div>
  </div>
}

