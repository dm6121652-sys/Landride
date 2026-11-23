import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Eye, EyeOff, ShieldCheck, X } from 'lucide-react'
import CampusMap from './CampusMap'
import './auth-polish.css'
import { supabase } from './lib/supabase'

type Props = { setupRequired?: boolean; initialMode?: 'signin' | 'signup'; onClose?: () => void }

export default function AuthPanel({ setupRequired = false, initialMode = 'signin', onClose }: Props) {
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode)
  const [name, setName] = useState('')
  const [matric, setMatric] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!onClose) return
    const bodyOverflow = document.body.style.overflow
    const bodyOverscroll = document.body.style.overscrollBehavior
    const rootOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.body.style.overscrollBehavior = 'none'
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = bodyOverflow
      document.body.style.overscrollBehavior = bodyOverscroll
      document.documentElement.style.overflow = rootOverflow
    }
  }, [onClose])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    setBusy(true); setMessage(''); setSuccess(false)
    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(), password,
        options: { data: { full_name: name.trim(), matric_number: matric.trim().toUpperCase() } },
      })
      if (error) setMessage(error.message)
      else if (data.session) setSuccess(true)
      else { setSuccess(true); setMessage('Check your school email to confirm your account, then sign in here.') }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) setMessage(error.message)
    }
    setBusy(false)
  }

  return <main className={`auth-screen ${onClose ? 'auth-overlay' : ''}`} onMouseDown={event => { if (event.target === event.currentTarget) onClose?.() }}>
    <div className="auth-backdrop auth-backdrop-one"/><div className="auth-backdrop auth-backdrop-two"/>
    <div className="auth-wrap">
      <header className="auth-header">{onClose && <button className="auth-close" type="button" onClick={onClose} aria-label="Close dialog"><X size={18}/></button>}</header>
      <section className="auth-card">
        <h1>{setupRequired ? 'Connect your ride service.' : mode === 'signin' ? 'Welcome back.' : 'Create your student account.'}</h1>
        <p className="auth-copy">{setupRequired ? 'Add your Supabase project details to .env.local to turn on student sign-in and live rides.' : mode === 'signin' ? 'Sign in with your school email to see shuttles and request a campus ride.' : 'Use your school email to create your account.'}</p>
        {setupRequired ? <div className="setup-steps"><div><span>01</span><p>Copy <code>.env.example</code> to <code>.env.local</code>.</p></div><div><span>02</span><p>Enter your Supabase URL and anon key, then restart the dev server.</p></div><div><span>03</span><p>Apply the Supabase migrations and add the approved stops and shuttles.</p></div></div> : <form onSubmit={submit}>
          {mode === 'signup' && <>
            <label className="input-label" htmlFor="student-name">FULL NAME</label><input className="auth-input" id="student-name" autoComplete="name" required value={name} onChange={e => setName(e.target.value)} placeholder="Your name"/>
            <label className="input-label" htmlFor="student-matric">MATRIC NUMBER</label><input className="auth-input" id="student-matric" autoComplete="off" required value={matric} onChange={e => setMatric(e.target.value)} placeholder="e.g. 2024/12345"/>
          </>}
          <label className="input-label" htmlFor="student-email">SCHOOL EMAIL</label><input className="auth-input" id="student-email" type="email" autoCapitalize="none" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@landmarkuniversity.edu.ng"/>
          <label className="input-label" htmlFor="student-password">PASSWORD</label><div className="password-field"><input className="auth-input" id="student-password" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={8} required value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters"/><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div>
          {message && <div className={`auth-message ${success ? 'auth-success' : ''}`}>{message}</div>}
          <button className="button button-primary auth-submit" disabled={busy}>{busy ? <><span className="auth-spinner" aria-hidden="true"/><span className="sr-only">Signing in</span></> : mode === 'signin' ? 'Sign in' : 'Create account'}</button>
        </form>}
        {!setupRequired && <div className="auth-switch">{mode === 'signin' ? <>New here? <button onClick={() => { setMode('signup'); setMessage('') }}>Create an account</button></> : <>Already registered? <button onClick={() => { setMode('signin'); setMessage('') }}>Sign in</button></>}</div>}
        <div className="auth-assurance"><ShieldCheck size={14}/> Your student account details stay private.</div>
      </section>
      {setupRequired && <section className="auth-map-preview"><div className="auth-map-title"><strong>Campus map preview</strong><span>Students choose destinations from the approved stops list.</span></div><CampusMap/></section>}
      <footer className="auth-footer">Campus rides, made simple</footer>
    </div>
  </main>
}
