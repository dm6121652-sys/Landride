import type { CSSProperties } from 'react'

function makeLetters(text: string, startAt: number) {
  return Array.from(text).map((character, index) => character === ' '
    ? <span key={`${startAt + index}-space`} className="hero-letter hero-letter-space" aria-hidden="true">{'\u00a0'}</span>
    : <span key={`${startAt + index}-${character}`} className="hero-letter" style={{ '--letter-index': startAt + index } as CSSProperties} aria-hidden="true">{character}</span>)
}

export default function HeroSection({ onAuth }: { onAuth: (mode: 'signin' | 'signup') => void }) {
  return (
    <section className="clean-hero">
      <div className="public-wrap clean-hero-inner">
        <div className="clean-hero-content">
          <h1 className="clean-hero-title" aria-label="Good days start with a better ride.">
            <span className="hero-title-line" aria-hidden="true">{makeLetters('Good days start', 0)}</span>
            <span className="hero-title-line hero-title-line-accent" aria-hidden="true">{makeLetters('with a better ride.', 16)}</span>
          </h1>
          <p className="clean-hero-subtitle">Campus travel, made easier. Find a shuttle, choose familiar stops and follow your ride from one simple place.</p>
          <div className="clean-hero-actions">
            <button className="hero-route-submit" onClick={() => onAuth('signup')}>Plan a campus ride</button>
            <a className="hero-explore-link" href="#how">Explore Landride</a>
          </div>
          <div className="hero-trust-bar"><span>Landmark campus stops</span><i aria-hidden="true"/><span>Live seat availability</span><i aria-hidden="true"/><span>One simple booking</span></div>
        </div>

      </div>
    </section>
  )
}
