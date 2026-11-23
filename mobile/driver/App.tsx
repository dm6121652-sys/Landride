import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, AppState, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native'
import * as Location from 'expo-location'
import * as Notifications from 'expo-notifications'
import * as TaskManager from 'expo-task-manager'
import { StatusBar as ExpoStatusBar } from 'expo-status-bar'
import { LOCATION_TASK } from './src/locationTask'
import { isSupabaseConfigured, supabase } from './src/supabase'

type DriverRide = {
  booking_id: string
  booking_status: 'pending' | 'confirmed' | 'picked_up' | 'completed' | 'cancelled' | 'no_show'
  seats: number
  sharing_ok: boolean
  requested_at: string
  trip_id: string
  trip_status: string
  departs_at: string | null
  vehicle_name: string
  pickup_name: string
  dropoff_name: string
}
type Vehicle = { id: string; name: string; seats_total: number }

const statusLabel: Record<DriverRide['booking_status'], string> = {
  pending: 'New request', confirmed: 'Accepted', picked_up: 'In progress', completed: 'Completed', cancelled: 'Cancelled', no_show: 'No-show',
}
const rideTime = (value: string | null) => value ? new Date(value).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : 'On demand'

export default function App() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [driverName, setDriverName] = useState('Driver')
  const [isDriver, setIsDriver] = useState(false)
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [online, setOnline] = useState(false)
  const [loadingSession, setLoadingSession] = useState(true)
  const [loadingDashboard, setLoadingDashboard] = useState(false)
  const [busy, setBusy] = useState(false)
  const [busyRideId, setBusyRideId] = useState<string | null>(null)
  const [rides, setRides] = useState<DriverRide[]>([])
  const [message, setMessage] = useState('')
  const [messageIsError, setMessageIsError] = useState(false)

  const loadRides = useCallback(async () => {
    if (!userId) return
    const { data, error } = await supabase.rpc('driver_rides')
    if (error) { setMessage(error.message); setMessageIsError(true); return }
    setRides((data ?? []) as DriverRide[])
  }, [userId])

  useEffect(() => {
    let alive = true
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return
      setUserId(data.session?.user.id ?? null)
      setOnline(data.session ? await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false) : false)
      setLoadingSession(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUserId(session?.user.id ?? null))
    return () => { alive = false; listener.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (!userId) { setRides([]); setVehicle(null); setIsDriver(false); return }
    let alive = true
    setLoadingDashboard(true)
    void Promise.all([
      supabase.from('profiles').select('role,display_name').eq('id', userId).single(),
      supabase.from('vehicles').select('id,name,seats_total').eq('driver_id', userId).maybeSingle(),
      supabase.rpc('driver_rides'),
    ]).then(([profileResult, vehicleResult, ridesResult]) => {
      if (!alive) return
      if (profileResult.error) { setMessage(profileResult.error.message); setMessageIsError(true) }
      const driver = profileResult.data?.role === 'driver'
      setIsDriver(driver)
      setDriverName(profileResult.data?.display_name?.split(' ')[0] || 'Driver')
      setVehicle(vehicleResult.data as Vehicle | null)
      if (ridesResult.error && driver) { setMessage(ridesResult.error.message); setMessageIsError(true) }
      else setRides((ridesResult.data ?? []) as DriverRide[])
      setLoadingDashboard(false)
    })
    const channel = supabase.channel(`driver-bookings-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => { void loadRides() })
      .subscribe()
    return () => { alive = false; void supabase.removeChannel(channel) }
  }, [userId, loadRides])

  // Expo background location can be paused by Android battery management. Keep
  // the driver's location fresh while the app is in use as well, so students'
  // five-minute availability check does not hide an online shuttle.
  useEffect(() => {
    if (!userId || !online) return
    let active = AppState.currentState === 'active'
    let updating = false
    const publishLocation = async () => {
      if (!active || updating) return
      updating = true
      try {
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        const { error } = await supabase.from('driver_locations').upsert({
          driver_id: userId,
          lat: current.coords.latitude,
          lng: current.coords.longitude,
          updated_at: new Date().toISOString(),
          online: true,
        })
        if (error) throw error
      } catch (error) {
        setMessage(error instanceof Error ? `Location refresh failed: ${error.message}` : 'Location refresh failed. Check the phone’s location and internet settings.')
        setMessageIsError(true)
      } finally {
        updating = false
      }
    }
    void publishLocation()
    const timer = setInterval(() => { void publishLocation() }, 45_000)
    const subscription = AppState.addEventListener('change', state => {
      active = state === 'active'
      if (active) void publishLocation()
    })
    return () => { clearInterval(timer); subscription.remove() }
  }, [userId, online])

  const activeRides = useMemo(() => rides.filter(ride => ['pending', 'confirmed', 'picked_up'].includes(ride.booking_status)), [rides])
  const completedRides = useMemo(() => rides.filter(ride => ['completed', 'cancelled', 'no_show'].includes(ride.booking_status)), [rides])

  async function signIn() {
    if (!isSupabaseConfigured) {
      setMessage('Supabase is missing from this driver build. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in mobile/driver/.env, then rebuild.')
      setMessageIsError(true)
      return
    }
    setBusy(true); setMessage(''); setMessageIsError(false)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) { setMessage(error.message); setMessageIsError(true) }
  }

  async function toggleOnline(value: boolean) {
    if (value && !vehicle) { setMessage('Ask the Landride owner to assign a shuttle to your driver account first.'); setMessageIsError(true); return }
    setBusy(true); setMessage(''); setMessageIsError(false)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Sign in again to change your online status.')
      if (value) {
        const foreground = await Location.requestForegroundPermissionsAsync()
        if (foreground.status !== 'granted') throw new Error('Allow location access to go online.')
        const background = await Location.requestBackgroundPermissionsAsync()
        if (background.status !== 'granted') throw new Error('Allow background location so students can see your shuttle while your screen is locked.')
        await Notifications.requestPermissionsAsync()
        if (!TaskManager.isTaskDefined(LOCATION_TASK)) throw new Error('Location service did not start. Close and reopen the driver app, then try again.')
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        const { error: tripError } = await supabase.rpc('driver_open_trip')
        if (tripError) throw new Error(tripError.message)
        await Location.startLocationUpdatesAsync(LOCATION_TASK, {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5000,
          distanceInterval: 10,
          pausesUpdatesAutomatically: false,
          showsBackgroundLocationIndicator: true,
          foregroundService: { notificationTitle: 'Landride is sharing your shuttle location', notificationBody: 'You are online. Tap to return to the driver app.', killServiceOnDestroy: false },
        })
        const { error } = await supabase.from('driver_locations').upsert({ driver_id: user.id, lat: current.coords.latitude, lng: current.coords.longitude, updated_at: new Date(current.timestamp).toISOString(), online: true })
        if (error) {
          await Location.stopLocationUpdatesAsync(LOCATION_TASK).catch(() => {})
          throw new Error(error.message)
        }
        setOnline(true)
        setMessage('You’re online. Students can request your shuttle now.')
      } else {
        if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) await Location.stopLocationUpdatesAsync(LOCATION_TASK)
        const { error } = await supabase.from('driver_locations').update({ online: false, updated_at: new Date().toISOString() }).eq('driver_id', user.id)
        setOnline(false)
        if (error) throw new Error(error.message)
        setMessage('You’re offline. Location sharing has stopped.')
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not change your online status.')
      setMessageIsError(true)
      if (value) setOnline(false)
    } finally { setBusy(false) }
  }

  async function updateRide(ride: DriverRide, next: 'confirmed' | 'cancelled' | 'picked_up' | 'completed' | 'no_show') {
    setBusyRideId(ride.booking_id); setMessage(''); setMessageIsError(false)
    const { error } = await supabase.rpc('driver_update_booking', { p_booking_id: ride.booking_id, p_next_status: next })
    if (error) { setMessage(error.message); setMessageIsError(true) }
    else { setMessage(next === 'confirmed' ? 'Ride accepted.' : next === 'picked_up' ? 'Ride started.' : next === 'completed' ? 'Ride completed.' : next === 'no_show' ? 'Ride marked no-show.' : 'Ride declined.'); await loadRides() }
    setBusyRideId(null)
  }

  async function signOut() {
    if (online) await toggleOnline(false)
    await supabase.auth.signOut()
  }

  return <SafeAreaView style={styles.safe}>
    <ExpoStatusBar style="dark"/>
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.brandRow}><View style={styles.mark}><Image source={require('./assets/landride-route-logo.png')} style={styles.markImage} resizeMode="contain"/></View><Text style={styles.brand}>landride<Text style={styles.brandDot}>.</Text></Text><Text style={styles.driverLabel}>DRIVER</Text></View>

      {loadingSession ? <View style={styles.centerState}><ActivityIndicator color="#0b8a4b"/><Text style={styles.stateText}>Checking your account…</Text></View> : !userId ? <View style={styles.loginCard}>
        <View style={styles.eyebrow}><Text style={styles.eyebrowText}>LANDMARK UNIVERSITY</Text></View>
        <Text style={styles.title}>Driver sign in</Text><Text style={styles.subtitle}>Access your assigned shuttle, ride requests, and location sharing.</Text>
        <Text style={styles.label}>EMAIL</Text><TextInput autoCapitalize="none" keyboardType="email-address" autoComplete="email" value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor="#87938b" style={styles.input}/>
        <Text style={styles.label}>PASSWORD</Text><TextInput secureTextEntry autoComplete="current-password" value={password} onChangeText={setPassword} placeholder="Your password" placeholderTextColor="#87938b" style={styles.input}/>
        {!!message && <Text style={styles.error}>{message}</Text>}
        <Pressable style={({ pressed }) => [styles.primary, pressed && styles.pressed]} onPress={signIn} disabled={busy || !email || !password}>{busy ? <ActivityIndicator color="white"/> : <Text style={styles.primaryText}>Sign in</Text>}</Pressable>
        <Text style={styles.loginHint}>Driver accounts and shuttle assignments are managed by the Landride owner.</Text>
      </View> : loadingDashboard ? <View style={styles.centerState}><ActivityIndicator color="#0b8a4b"/><Text style={styles.stateText}>Loading your driver dashboard…</Text></View> : !isDriver ? <View style={styles.loginCard}><Text style={styles.title}>Driver access needed</Text><Text style={styles.subtitle}>This account isn’t registered as a Landride driver.</Text><Pressable style={styles.secondaryButton} onPress={signOut}><Text style={styles.secondaryText}>Sign out</Text></Pressable></View> : <>
        <View style={styles.greeting}><Text style={styles.eyebrowText}>DRIVER SPACE</Text><Text style={styles.title}>Ready to roll, {driverName}?</Text><Text style={styles.subtitle}>{vehicle ? `${vehicle.name}  ·  ${vehicle.seats_total} seats` : 'No shuttle is assigned to your account yet.'}</Text></View>

        <View style={[styles.onlineCard, online && styles.onlineCardActive]}><View style={[styles.onlineIcon,{backgroundColor:online?'#e5f2e9':'#f1eeeb'}]}><View style={[styles.dot,{backgroundColor:online?'#0b8a4b':'#9b785c'}]}/></View><View style={styles.onlineCopy}><Text style={styles.onlineTitle}>{online?'You’re on the road':'You’re off duty'}</Text><Text style={styles.onlineSub}>{online?'Your location is live and students can find your shuttle.':'Go online when you’re ready to receive ride requests.'}</Text></View><Switch value={online} onValueChange={toggleOnline} disabled={busy || !vehicle} trackColor={{ false:'#d1d2cf', true:'#78c99a' }} thumbColor={online?'#087a43':'#fff'}/></View>

        {!!message && <Text style={messageIsError ? styles.error : styles.success}>{message}</Text>}
        {!vehicle && <View style={styles.assignmentCard}><Text style={styles.assignmentTitle}>Shuttle assignment needed</Text><Text style={styles.assignmentText}>Ask the Landride owner to assign your driver account to a vehicle. You can then go online and receive rides.</Text></View>}

        <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Ride requests</Text><Text style={styles.sectionSubtitle}>{activeRides.length ? `${activeRides.length} active ${activeRides.length === 1 ? 'ride' : 'rides'}` : 'Requests assigned to your shuttle appear here.'}</Text></View><Pressable onPress={() => void loadRides()} style={styles.refreshButton} accessibilityLabel="Refresh ride requests"><Text style={styles.refreshText}>Refresh</Text></Pressable></View>
        {activeRides.length ? <View style={styles.rideList}>{activeRides.map(ride => <DriverRideCard key={ride.booking_id} ride={ride} busy={busyRideId === ride.booking_id} onUpdate={next => void updateRide(ride, next)}/>)}</View> : <View style={styles.emptyCard}><View style={styles.emptyIcon}><Image source={require('./assets/landride-emblem.png')} style={styles.emptyLogo} resizeMode="contain"/></View><Text style={styles.emptyTitle}>No ride requests yet</Text><Text style={styles.emptyText}>{online ? 'Stay online. New requests for your shuttle will show up here.' : 'Go online to receive student ride requests.'}</Text></View>}

        {completedRides.length > 0 && <View style={styles.historyCard}><Text style={styles.historyTitle}>Recent rides</Text>{completedRides.slice(0,3).map(ride => <View key={ride.booking_id} style={styles.historyRow}><View style={styles.historyMain}><Text style={styles.historyRoute} numberOfLines={1}>{ride.pickup_name} → {ride.dropoff_name}</Text><Text style={styles.historyMeta}>{rideTime(ride.departs_at)} · {ride.seats} {ride.seats === 1 ? 'seat' : 'seats'}</Text></View><Text style={styles.historyStatus}>{statusLabel[ride.booking_status]}</Text></View>)}</View>}

        <View style={styles.tipCard}><Text style={styles.tipTitle}>Location sharing</Text><Text style={styles.tipText}>Allow background location and exclude Landride from battery optimization so your shuttle stays visible when the screen is locked.</Text><View style={styles.tipDivider}/><Text style={styles.tipFoot}>A persistent notification appears while you’re online.</Text></View>
        <View style={styles.bottom}><Text style={styles.bottomText}>Landmark University · Driver pilot</Text><Pressable onPress={signOut}><Text style={styles.signOut}>Sign out</Text></Pressable></View>
      </>}
    </ScrollView>
  </SafeAreaView>
}

function DriverRideCard({ ride, busy, onUpdate }: { ride: DriverRide; busy: boolean; onUpdate: (status: 'confirmed' | 'cancelled' | 'picked_up' | 'completed' | 'no_show') => void }) {
  return <View style={styles.rideCard}>
    <View style={styles.rideCardTop}><View style={styles.statusPill}><View style={styles.statusDot}/><Text style={styles.statusText}>{statusLabel[ride.booking_status]}</Text></View><Text style={styles.tripTime}>{rideTime(ride.departs_at)}</Text></View>
    <Text style={styles.rideRoute}>{ride.pickup_name}<Text style={styles.routeArrow}>  →  </Text>{ride.dropoff_name}</Text>
    <Text style={styles.rideDetails}>{ride.seats} {ride.seats === 1 ? 'seat' : 'seats'}{ride.sharing_ok ? ' · Shared ride' : ' · Private ride'} · {ride.vehicle_name}</Text>
    {ride.booking_status === 'pending' && <View style={styles.rideActions}><Pressable style={styles.declineButton} onPress={() => onUpdate('cancelled')} disabled={busy}><Text style={styles.declineText}>Decline</Text></Pressable><Pressable style={styles.acceptButton} onPress={() => onUpdate('confirmed')} disabled={busy}>{busy ? <ActivityIndicator color="#fff"/> : <Text style={styles.acceptText}>Accept ride</Text>}</Pressable></View>}
    {ride.booking_status === 'confirmed' && <View style={styles.rideActions}><Pressable style={styles.declineButton} onPress={() => onUpdate('no_show')} disabled={busy}><Text style={styles.declineText}>No-show</Text></Pressable><Pressable style={styles.acceptButton} onPress={() => onUpdate('picked_up')} disabled={busy}>{busy ? <ActivityIndicator color="#fff"/> : <Text style={styles.acceptText}>Start ride</Text>}</Pressable></View>}
    {ride.booking_status === 'picked_up' && <Pressable style={styles.acceptButton} onPress={() => onUpdate('completed')} disabled={busy}>{busy ? <ActivityIndicator color="#fff"/> : <Text style={styles.acceptText}>Complete ride</Text>}</Pressable>}
  </View>
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#f5f4ef'},container:{flexGrow:1,width:'100%',maxWidth:720,alignSelf:'center',paddingHorizontal:22,paddingTop:14,paddingBottom:32},brandRow:{height:48,flexDirection:'row',alignItems:'center',gap:10,marginBottom:12},mark:{width:42,height:42,borderRadius:13,backgroundColor:'#073d2a',borderWidth:1,borderColor:'#d9e8dc',alignItems:'center',justifyContent:'center',overflow:'hidden'},markImage:{width:39,height:39},brand:{fontSize:22,fontWeight:'800',letterSpacing:-1,color:'#143e2a'},brandDot:{color:'#0b8a4b'},driverLabel:{marginLeft:'auto',fontSize:10,fontWeight:'800',letterSpacing:1.4,color:'#7c897f'},centerState:{minHeight:280,alignItems:'center',justifyContent:'center',gap:12},stateText:{fontSize:13,color:'#728078'},loginCard:{backgroundColor:'#fff',borderColor:'#dfe8e2',borderWidth:1,borderRadius:24,padding:26,marginTop:38,shadowColor:'#163c29',shadowOpacity:.06,shadowRadius:18,shadowOffset:{width:0,height:8},elevation:2},eyebrow:{flexDirection:'row',alignItems:'center',marginBottom:11},eyebrowText:{fontSize:10,fontWeight:'800',letterSpacing:1.1,color:'#0b7540'},title:{fontSize:26,fontWeight:'800',letterSpacing:-.8,color:'#182a20',marginTop:6},subtitle:{fontSize:13,lineHeight:19,color:'#69776e',marginTop:7,marginBottom:19},label:{fontSize:10,fontWeight:'800',letterSpacing:1,color:'#637267',marginBottom:7,marginTop:13},input:{height:48,borderWidth:1,borderColor:'#dfe8e2',borderRadius:11,paddingHorizontal:13,color:'#182a20',fontSize:14,backgroundColor:'#fbfdfb'},primary:{height:49,borderRadius:11,backgroundColor:'#0b7540',alignItems:'center',justifyContent:'center',marginTop:19},primaryText:{fontSize:14,fontWeight:'700',color:'#fff'},pressed:{opacity:.85,transform:[{scale:.99}]},loginHint:{textAlign:'center',fontSize:11,lineHeight:16,color:'#87928a',marginTop:16},greeting:{marginTop:22,marginBottom:4},onlineCard:{marginTop:12,backgroundColor:'#fff',borderColor:'#dfe8e2',borderWidth:1,borderRadius:20,padding:18,flexDirection:'row',alignItems:'center',gap:12,shadowColor:'#163c29',shadowOpacity:.04,shadowRadius:12,shadowOffset:{width:0,height:5},elevation:1},onlineCardActive:{borderColor:'#b9d6c2'},onlineIcon:{width:42,height:42,borderRadius:13,alignItems:'center',justifyContent:'center'},dot:{width:12,height:12,borderRadius:6},onlineCopy:{flex:1},onlineTitle:{fontSize:15,fontWeight:'800',color:'#203629'},onlineSub:{fontSize:11,lineHeight:16,color:'#748279',marginTop:4},sectionHeader:{marginTop:25,marginBottom:11,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},sectionTitle:{fontSize:19,fontWeight:'800',letterSpacing:-.4,color:'#182a20'},sectionSubtitle:{fontSize:11,color:'#7b877f',marginTop:3},refreshButton:{paddingHorizontal:12,paddingVertical:8,borderWidth:1,borderColor:'#d8e4da',borderRadius:9,backgroundColor:'#fff'},refreshText:{fontSize:11,fontWeight:'700',color:'#37644a'},rideList:{gap:10},rideCard:{padding:17,borderRadius:19,borderWidth:1,borderColor:'#dfe8e2',backgroundColor:'#fff'},rideCardTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},statusPill:{flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:9,paddingVertical:5,backgroundColor:'#f1f5f1',borderRadius:20},statusDot:{width:6,height:6,borderRadius:4,backgroundColor:'#a17b5a'},statusText:{fontSize:10,fontWeight:'700',color:'#5c6d61'},tripTime:{fontSize:10,color:'#77847b'},rideRoute:{fontSize:16,fontWeight:'800',lineHeight:23,color:'#203629',marginTop:12},routeArrow:{color:'#0b8a4b'},rideDetails:{fontSize:11,color:'#77847b',marginTop:5},rideActions:{flexDirection:'row',gap:8,marginTop:14},acceptButton:{minHeight:42,flex:1,borderRadius:10,backgroundColor:'#0b7540',alignItems:'center',justifyContent:'center',paddingHorizontal:14},acceptText:{fontSize:12,fontWeight:'800',color:'#fff'},declineButton:{minHeight:42,borderWidth:1,borderColor:'#eadbd4',borderRadius:10,alignItems:'center',justifyContent:'center',paddingHorizontal:15},declineText:{fontSize:12,fontWeight:'700',color:'#956a52'},emptyCard:{marginTop:3,minHeight:160,padding:22,borderRadius:19,borderWidth:1,borderStyle:'dashed',borderColor:'#d6e2d8',backgroundColor:'#fbfdfb',alignItems:'center',justifyContent:'center'},emptyIcon:{width:38,height:38,borderRadius:12,overflow:'hidden',backgroundColor:'#edf5ef',alignItems:'center',justifyContent:'center',marginBottom:8},emptyLogo:{width:40,height:40},emptyTitle:{fontSize:13,fontWeight:'800',color:'#2a3b30'},emptyText:{maxWidth:280,fontSize:11,lineHeight:16,color:'#748279',textAlign:'center',marginTop:4},historyCard:{marginTop:18,padding:16,borderRadius:15,borderWidth:1,borderColor:'#dfe8e2',backgroundColor:'#fff'},historyTitle:{fontSize:14,fontWeight:'800',color:'#26382d',marginBottom:6},historyRow:{minHeight:52,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:9,borderTopWidth:1,borderTopColor:'#edf1ed'},historyMain:{flex:1},historyRoute:{fontSize:11,fontWeight:'700',color:'#35483a'},historyMeta:{fontSize:10,color:'#87928a',marginTop:3},historyStatus:{fontSize:9,fontWeight:'700',color:'#77847b'},assignmentCard:{marginTop:13,padding:15,borderRadius:13,borderWidth:1,borderColor:'#eadfd4',backgroundColor:'#fbf6f1'},assignmentTitle:{fontSize:12,fontWeight:'800',color:'#634d3a'},assignmentText:{fontSize:11,lineHeight:16,color:'#806c59',marginTop:5},tipCard:{marginTop:16,borderRadius:14,backgroundColor:'#eaf2ec',padding:15},tipTitle:{fontSize:12,fontWeight:'800',color:'#344d3a'},tipText:{fontSize:11,lineHeight:17,color:'#687a6b',marginTop:6},tipDivider:{height:1,backgroundColor:'#d9e5db',marginVertical:11},tipFoot:{fontSize:10,lineHeight:15,color:'#77877a'},bottom:{marginTop:20,paddingTop:17,borderTopWidth:1,borderTopColor:'#e1e9e2',flexDirection:'row',alignItems:'center',justifyContent:'space-between'},bottomText:{fontSize:10,color:'#8a948d'},signOut:{fontSize:11,fontWeight:'800',color:'#4d6954'},secondaryButton:{height:42,marginTop:17,borderRadius:10,borderWidth:1,borderColor:'#dfe8e2',alignItems:'center',justifyContent:'center'},secondaryText:{fontSize:13,fontWeight:'700',color:'#37644a'},error:{fontSize:11,lineHeight:16,color:'#9f493d',marginTop:11,padding:10,backgroundColor:'#fff1ed',borderRadius:9},success:{fontSize:11,lineHeight:16,color:'#326449',marginTop:11,padding:10,backgroundColor:'#eaf5ed',borderRadius:9}
})
