import { useCallback, useEffect, useMemo, type CSSProperties } from 'react'
import { motion, stagger, useAnimate, type Transition } from 'framer-motion'

export type CampusChatMessage = {
  text: string
  sender: 'student' | 'guide'
  timestamp?: string
}

type CampusChatMessagesProps = {
  messages: CampusChatMessage[]
  showTimestamps?: boolean
  animate?: boolean
  staggerDelay?: number
  style?: CSSProperties
}

const HIDDEN = { opacity: 0, scale: 0.94, y: 9 }
const SHOWN = { opacity: 1, scale: 1, y: 0 }
const SPRING: Transition = { type: 'spring', stiffness: 430, damping: 30, mass: 0.85 }

function CampusChatMessages({ messages, showTimestamps = false, animate: shouldAnimate = true, staggerDelay = 125, style }: CampusChatMessagesProps) {
  const [scope, animate] = useAnimate()
  const transition = useMemo(() => SPRING, [])

  const resetMessages = useCallback(() => {
    if (!scope.current?.querySelectorAll('.campus-chat-message').length) return
    animate('.campus-chat-message', HIDDEN, { duration: 0 })
  }, [animate, scope])

  const revealMessages = useCallback(() => {
    if (!scope.current?.querySelectorAll('.campus-chat-message').length) return
    animate('.campus-chat-message', SHOWN, {
      ...transition,
      delay: stagger(staggerDelay / 1000),
    } as any)
  }, [animate, scope, staggerDelay, transition])

  useEffect(() => {
    if (!shouldAnimate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      animate('.campus-chat-message', SHOWN, { duration: 0 })
      return
    }
    resetMessages()
    const timer = window.setTimeout(revealMessages, 50)
    return () => window.clearTimeout(timer)
  }, [animate, messages.length, resetMessages, revealMessages, shouldAnimate])

  return <div ref={scope} className="campus-chat-messages" style={style}>
    {messages.map((message, index) => {
      const fromStudent = message.sender === 'student'
      return <div className={`campus-chat-row ${fromStudent ? 'from-student' : 'from-guide'}`} key={`${message.sender}-${index}`}>
        <motion.div className={`campus-chat-message ${fromStudent ? 'student-message' : 'guide-message'}`}>
          {!fromStudent && <span className="campus-chat-sender">LANDRIDE GUIDE</span>}
          {showTimestamps && message.timestamp && <span className="campus-chat-time">{message.timestamp}</span>}
          <span>{message.text}</span>
        </motion.div>
      </div>
    })}
  </div>
}

const exampleMessages: CampusChatMessage[] = [
  { sender: 'student', text: 'Can I get a ride from the Library to First College Building?' },
  { sender: 'guide', text: 'Choose those stops, then search to see shuttles with live seats available.' },
  { sender: 'student', text: 'I need one seat. How do I book it?' },
  { sender: 'guide', text: 'Select a shuttle and send your request. The driver will confirm it in Landride.' },
]

export default function CampusBookingChat() {
  return <section className="booking-chat-section" aria-labelledby="booking-chat-title">
    <div className="public-wrap booking-chat-grid">
      <div className="booking-chat-copy">
        <span className="editorial-eyebrow editorial-eyebrow-green">A RIDE FLOW THAT MAKES SENSE</span>
        <h2 id="booking-chat-title">A few clear steps.<br/><em>A ride on the way.</em></h2>
        <p>See how Landride guides a student from choosing campus stops to sending a shuttle request.</p>
        <div className="booking-chat-facts"><span>Pickup and destination</span><span>Seats available</span><span>Driver confirmation</span></div>
      </div>
      <div className="booking-chat-card">
        <div className="booking-chat-card-head"><span className="booking-chat-icon"><span>LU</span></span><span><strong>Landride ride guide</strong><small>Example booking conversation</small></span><span className="booking-chat-tag">CAMPUS TRIPS</span></div>
        <CampusChatMessages messages={exampleMessages}/>
        <div className="booking-chat-card-foot"><span>Booking starts in the student dashboard</span></div>
      </div>
    </div>
  </section>
}
