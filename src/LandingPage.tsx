import { lazy, Suspense, useEffect, type SyntheticEvent } from 'react'
import { BusFront, Clock3, MapPin, ShieldCheck, Users } from 'lucide-react'
import './landing.css'
import './navbar.css'
import Brand from './Brand'
import CampusSimulator from './CampusSimulator'
import ThemeToggle from './ThemeToggle'
import TraditionalFooter from './TraditionalFooter'
import HeroSection from './HeroSection'

const CampusBookingChat = lazy(() => import('./CampusBookingChat'))

const campusPhotos = {
  academic: 'https://images.ctfassets.net/ikr7jul0n9mj/6d9uGqCiYAV6Y1qXvmuox2/322a4fc03f62555ee450bced28d86079/lmu3.jpg',
  road: '/campus-road.jpg',
  residence: '/student-residence.jpg',
  grounds: '/alandmark.jpg',
}

export default function LandingPage({ darkMode, onToggleTheme, onAuth }: { darkMode: boolean; onToggleTheme: () => void; onAuth: (mode: 'signin' | 'signup') => void }) {
  useEffect(() => {
    const page = document.querySelector('.public-site')
    const items = [...document.querySelectorAll<HTMLElement>('.public-site [data-reveal]')]
    if (!page || !items.length) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      items.forEach(item => item.classList.add('is-visible'))
      return
    }
    items.forEach((item, index) => item.style.setProperty('--reveal-index', String(index % 3)))
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('is-visible')
        observer.unobserve(entry.target)
      })
    }, { threshold: 0.14, rootMargin: '0px 0px -24px 0px' })
    items.forEach(item => observer.observe(item))
    page.classList.add('reveal-ready')
    return () => { observer.disconnect(); page.classList.remove('reveal-ready') }
  }, [])

  useEffect(() => {
    const header = document.querySelector<HTMLElement>('.editorial-header')
    if (!header) return
    let scheduled = false
    const updateHeader = () => {
      const currentY = Math.max(0, window.scrollY)
      if (currentY < 36) {
        header.classList.remove('nav-scroll-returning')
      } else {
        header.classList.add('nav-scroll-returning')
      }
      scheduled = false
    }
    const onScroll = () => {
      if (scheduled) return
      scheduled = true
      window.requestAnimationFrame(updateHeader)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      header.classList.remove('nav-scroll-returning')
    }
  }, [])

  const photoError = (event: SyntheticEvent<HTMLImageElement>) => event.currentTarget.classList.add('photo-image-failed')

  return <div className="public-site editorial-site">
    <header className="public-header editorial-header"><div className="public-wrap public-nav">
      <a className="public-brand-link" href="#home" aria-label="Landride home"><Brand/></a>
      <nav className="public-links" aria-label="Main navigation"><a href="#how">How it works</a><a href="#campus">Campus</a><a href="#about">About</a><a href="#faq">FAQs</a></nav>
      <div className="public-actions"><ThemeToggle darkMode={darkMode} onToggle={onToggleTheme}/><button className="button button-quiet" onClick={() => onAuth('signin')}>Sign in</button><button className="button button-primary button-small" onClick={() => onAuth('signup')}>Get started</button></div>
    </div></header>

    <main id="home">
      <HeroSection onAuth={onAuth} />

      <section id="how" className="public-section editorial-how"><div className="public-wrap">
        <div className="editorial-section-heading"><div><span className="editorial-eyebrow editorial-eyebrow-green">A SIMPLE WAY TO GET THERE</span><h2>From your stop<br/>to your destination.</h2></div><p>Everything you need to plan a campus ride is in one clear flow.</p></div>
        <div className="editorial-steps">
          <article className="editorial-step" data-reveal><span className="editorial-step-number">01</span><div className="editorial-step-icon"><MapPin size={21}/></div><h3>Choose your stops</h3><p>Pick your starting point and destination from approved campus locations.</p></article>
          <article className="editorial-step editorial-step-highlight" data-reveal><span className="editorial-step-number">02</span><div className="editorial-step-icon"><BusFront size={21}/></div><h3>Find your shuttle</h3><p>Search for online shuttles and compare the seats available for your trip.</p></article>
          <article className="editorial-step" data-reveal><span className="editorial-step-number">03</span><div className="editorial-step-icon"><Clock3 size={21}/></div><h3>Follow your ride</h3><p>Keep up with your request and upcoming journeys in your dashboard.</p></article>
        </div>
      </div></section>

      <Suspense fallback={<div className="booking-chat-loader" aria-label="Loading booking conversation preview"/>}><CampusBookingChat/></Suspense>

      <section id="campus" className="editorial-campus-section"><div className="public-wrap editorial-campus-grid">
        <div className="editorial-map-frame" data-reveal><CampusSimulator/></div>
        <div className="editorial-campus-copy"><span className="editorial-eyebrow editorial-eyebrow-green">YOUR CAMPUS, IN VIEW</span><h2>Know the way<br/>before you go.</h2><p>Get a feel for the campus route and its familiar landmarks, then choose your pickup and destination from the student dashboard.</p><div className="editorial-campus-points"><span><MapPin size={16}/> Known campus locations</span><span><Users size={16}/> Shuttle seats at a glance</span></div><button className="button button-primary" onClick={() => onAuth('signup')}>Find a campus shuttle</button></div>
      </div></section>

      <section id="about" className="editorial-about-section"><div className="public-wrap editorial-about-grid">
        <div className="editorial-about-copy"><span className="editorial-eyebrow">A LITTLE ABOUT LANDRIDE</span><h2>Built around the<br/><em>Landmark</em> community.</h2><p>Landride is a campus shuttle service concept designed to make everyday trips around Landmark University easier to plan and follow. Students choose approved campus stops, search live shuttle availability and manage requests from their dashboard.</p><p>Drivers share their shuttle status and respond to ride requests through the driver app, keeping both sides connected as a trip comes together.</p><button className="button editorial-button-yellow" onClick={() => onAuth('signup')}>Join the campus ride</button></div>
        <div className="editorial-about-visual" data-reveal><img src={campusPhotos.grounds} alt="Green grounds and academic buildings at Landmark University" loading="lazy" onError={photoError}/><div className="editorial-about-caption"><span>LANDMARK UNIVERSITY</span><strong>Campus life moves<br/>one ride at a time.</strong></div><div className="editorial-about-mark"><ShieldCheck size={20}/><span>Student-first<br/>campus service</span></div></div>
      </div></section>

      <section id="gallery" className="editorial-gallery-section"><div className="public-wrap"><div className="editorial-section-heading"><div><span className="editorial-eyebrow editorial-eyebrow-green">PLACES THAT FEEL LIKE CAMPUS</span><h2>Familiar paths.<br/>Everyday destinations.</h2></div><p>A few glimpses of the spaces and routes that make Landmark feel like home.</p></div><div className="editorial-gallery">
        <figure className="gallery-photo gallery-photo-wide" data-reveal><img src={campusPhotos.academic} alt="Academic buildings at Landmark University" loading="lazy" onError={photoError}/><figcaption>Learning spaces <span>01</span></figcaption></figure>
        <figure className="gallery-photo gallery-photo-tall" data-reveal><img src={campusPhotos.road} alt="Campus road and greenery at Landmark University" loading="lazy" onError={photoError}/><figcaption>Campus roads <span>02</span></figcaption></figure>
        <figure className="gallery-photo gallery-photo-wide" data-reveal><img src={campusPhotos.residence} alt="Residence buildings on campus" loading="lazy" onError={photoError}/><figcaption>Student residences <span>03</span></figcaption></figure>
      </div></div></section>

      <section id="faq" className="public-section editorial-faq"><div className="public-wrap faq-grid"><div className="section-intro"><span className="editorial-eyebrow editorial-eyebrow-green">GOOD TO KNOW</span><h2>Campus rides,<br/>clearly explained.</h2><p>Quick answers about using Landride.</p></div><div className="faq-list"><details data-reveal><summary>Who can use Landride?</summary><p>Landride is being built for Landmark University students and the campus shuttle drivers assigned to the service.</p></details><details data-reveal><summary>How do I choose where I’m going?</summary><p>Sign in, then select your pickup and destination from the enabled campus stops in the student dashboard.</p></details><details data-reveal><summary>Why might a shuttle not appear?</summary><p>Only shuttles with a current online driver and enough open seats appear in search results.</p></details></div></div></section>

      <section className="editorial-final-cta"><div className="public-wrap"><div className="editorial-final-cta-card" data-reveal><div><span className="editorial-eyebrow">MAKE YOUR NEXT TRIP EASIER</span><h2>Your next campus ride<br/>starts here.</h2><p>Sign in to choose your stops and find an available shuttle.</p></div><button className="button editorial-button-yellow" onClick={() => onAuth('signup')}>Get started</button></div></div></section>
    </main>

    <TraditionalFooter />
  </div>
}
