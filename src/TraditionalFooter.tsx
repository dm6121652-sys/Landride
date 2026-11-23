import { Globe, Linkedin, Instagram } from 'lucide-react'
import Brand from './Brand'

const footerColumns = [
  {
    title: 'About',
    items: [
      { label: 'About Landride', href: '#about' },
      { label: 'How it works', href: '#how' },
      { label: 'Landmark campus', href: '#campus' },
      { label: 'Campus community', href: '#about' },
    ],
  },
  {
    title: 'Rides',
    items: [
      { label: 'Book a ride', href: '#home' },
      { label: 'Campus stops', href: '#campus' },
      { label: 'Live shuttle status', href: '#campus' },
    ],
  },
  {
    title: 'Safety',
    items: [
      { label: 'Campus safety', href: '#about' },
      { label: 'Student guidelines', href: '#faq' },
      { label: 'Approved routes', href: '#campus' },
    ],
  },
  {
    title: 'Support',
    items: [
      { label: 'Help Center', href: '#faq' },
      { label: 'Campus FAQs', href: '#faq' },
      { label: 'Contact transport', href: '#faq' },
    ],
  },
]

export default function TraditionalFooter() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="traditional-footer" aria-label="Landride traditional footer">
      <div className="traditional-footer-wrap">
        {/* Brand & Help Center */}
        <div className="traditional-footer-top">
          <a href="#home" className="traditional-footer-brand-link" aria-label="Landride Home">
            <Brand />
          </a>
          <a href="#faq" className="traditional-footer-help-link">
            Visit Help Center
          </a>
        </div>

        {/* 4 Navigation columns tailored for campus shuttle */}
        <div className="traditional-footer-grid">
          {footerColumns.map((column, colIdx) => (
            <div key={colIdx} className="traditional-footer-col">
              <ul className="traditional-footer-list">
                {column.items.map((item, itemIdx) => (
                  <li key={itemIdx}>
                    <a href={item.href} className="traditional-footer-link">
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Socials & Language selector row */}
        <div className="traditional-footer-actions-row">
          <div className="traditional-footer-socials" aria-label="Social media links">
            <a href="https://linkedin.com" target="_blank" rel="noreferrer" className="traditional-social-btn" aria-label="LinkedIn">
              <Linkedin size={18} />
            </a>
            <a href="https://instagram.com" target="_blank" rel="noreferrer" className="traditional-social-btn" aria-label="Instagram">
              <Instagram size={18} />
            </a>
            <a href="https://x.com" target="_blank" rel="noreferrer" className="traditional-social-btn" aria-label="X (Twitter)">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          </div>

          <div className="traditional-footer-selectors">
            <button type="button" className="traditional-selector-btn" aria-label="Select language">
              <Globe size={16} />
              <span>English</span>
            </button>
          </div>
        </div>

        {/* App store download badges */}
        <div className="traditional-footer-apps">
          <a href="#download" onClick={e => e.preventDefault()} className="traditional-app-badge" aria-label="Get it on Google Play">
            <svg viewBox="0 0 512 512" width="22" height="22" aria-hidden="true">
              <path fill="#4285F4" d="M32.5 3.5C21.7 15.3 16 32.8 16 54.4v403.2c0 21.6 5.7 39.1 16.5 50.9l2.7 2.5L257 289.2V279l-221.8-278-2.7 2.5z"/>
              <path fill="#FFBA00" d="M331 363.3l-74-74.1V279l74-74.1 1.7 1 87.8 49.9c25.1 14.3 25.1 37.6 0 51.9l-87.8 50-1.7 4.6z"/>
              <path fill="#EA4335" d="M332.7 362.3L257 284.1 32.5 508.5c8.3 8.8 21.9 9.8 37.3 1.1l262.9-147.3z"/>
              <path fill="#34A853" d="M332.7 149.7L69.8 2.4C54.4-6.3 40.8-5.3 32.5 3.5L257 227.9l75.7-78.2z"/>
            </svg>
            <div className="traditional-badge-text">
              <span className="traditional-badge-sub">GET IT ON</span>
              <span className="traditional-badge-main">Google Play</span>
            </div>
          </a>

          <a href="#download" onClick={e => e.preventDefault()} className="traditional-app-badge" aria-label="Download on the App Store">
            <svg viewBox="0 0 384 512" width="20" height="20" fill="currentColor" aria-hidden="true">
              <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 66.2 27.9 123.6c13.7 27.8 35.8 61.4 66.3 60.5 28.5-.9 40.4-18.2 74.4-18.2 34.1 0 44.8 18.2 74.3 17.6 30.6-.6 50.3-30.8 63.8-58.6 15.6-32.3 22-63.5 22.3-65.1-1.2-.6-44.2-16.9-44.3-64.6zM287.9 92.5c16.3-19.8 26.6-47.3 23.6-74.8-23.7 1-52.4 15.8-69.4 35.6-14.8 17.2-27.7 45.1-24.2 72 26.4 2 53.7-13.6 70-32.8z"/>
            </svg>
            <div className="traditional-badge-text">
              <span className="traditional-badge-sub">Download on the</span>
              <span className="traditional-badge-main">App Store</span>
            </div>
          </a>
        </div>

        {/* Bottom copyright & legal row */}
        <div className="traditional-footer-bottom">
          <p className="traditional-footer-copyright">
            © {currentYear} Landride Technologies Inc.
          </p>
          <div className="traditional-footer-legal">
            <a href="#privacy" className="traditional-footer-legal-link">Privacy</a>
            <a href="#accessibility" className="traditional-footer-legal-link">Accessibility</a>
            <a href="#terms" className="traditional-footer-legal-link">Terms</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
