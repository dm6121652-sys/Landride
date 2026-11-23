import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import AuthPanel from './AuthPanel'
import StudentApp from './StudentApp'
import LandingPage from './LandingPage'
import { Brand } from './Brand'
import { supabase, supabaseConfigured } from './lib/supabase'

export default function App() {
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem('landride-theme') === 'dark' } catch { return false }
  })
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileReady, setProfileReady] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [matricNumber, setMatricNumber] = useState('')
  const [accessError, setAccessError] = useState('')
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', darkMode ? '#101113' : '#f5f2e9')
    try { localStorage.setItem('landride-theme', darkMode ? 'dark' : 'light') } catch { /* Theme still applies for this session. */ }
  }, [darkMode])

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    let alive = true
    supabase.auth.getSession().then(({ data }) => {
      if (alive) { setSession(data.session); setLoading(false) }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => { alive = false; subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (!supabase || !session) { setProfileReady(false); setAccessError(''); return }
    let alive = true
    void supabase.from('profiles').select('role,display_name,matric_number').eq('id', session.user.id).single().then(({ data, error }) => {
      if (!alive) return
      if (error) { setAccessError(error.message); setProfileReady(true); return }
      if (data.role !== 'student') { setAccessError('This account is not set up as a student account.'); setProfileReady(true); return }
      setDisplayName(data.display_name || session.user.email || 'Student')
      setMatricNumber(data.matric_number || '')
      setAccessError('')
      setProfileReady(true)
    })
    return () => { alive = false }
  }, [session])

  if (loading) return <div className="auth-screen"><div className="auth-card loading-card">Loading your campus…</div></div>
  if (!supabaseConfigured || !session) return <>
    <LandingPage darkMode={darkMode} onToggleTheme={() => setDarkMode(value => !value)} onAuth={mode => { setAuthMode(mode); setAuthOpen(true) }}/>
    {authOpen && <AuthPanel setupRequired={!supabaseConfigured} initialMode={authMode} onClose={() => setAuthOpen(false)}/>}
  </>
  if (!profileReady) return <div className="auth-screen"><div className="auth-card loading-card">Checking your student account…</div></div>
  if (accessError) return <div className="auth-screen"><div className="auth-card"><Brand/><h1>Account setup needed</h1><p className="auth-copy">{accessError}</p><button className="button button-primary" onClick={() => supabase?.auth.signOut()}>Sign out</button></div></div>
  return <StudentApp displayName={displayName} matricNumber={matricNumber} darkMode={darkMode} onToggleTheme={() => setDarkMode(value => !value)} session={session}/>
}
