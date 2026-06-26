'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  motion, useMotionValue, useSpring, useScroll, useTransform, useInView,
  type MotionValue,
} from 'framer-motion'

// ─── Mouse tracking ────────────────────────────────────────────────────────

export function useMousePosition() {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  useEffect(() => {
    const h = (e: MouseEvent) => { x.set(e.clientX); y.set(e.clientY) }
    window.addEventListener('mousemove', h)
    return () => window.removeEventListener('mousemove', h)
  }, [x, y])
  return { x, y }
}

// Spring-smoothed version
export function useSmoothMouse(stiffness = 80, damping = 20) {
  const rawX = useMotionValue(typeof window !== 'undefined' ? window.innerWidth / 2 : 0)
  const rawY = useMotionValue(typeof window !== 'undefined' ? window.innerHeight / 2 : 0)
  const x = useSpring(rawX, { stiffness, damping })
  const y = useSpring(rawY, { stiffness, damping })
  useEffect(() => {
    const h = (e: MouseEvent) => { rawX.set(e.clientX); rawY.set(e.clientY) }
    window.addEventListener('mousemove', h)
    return () => window.removeEventListener('mousemove', h)
  }, [rawX, rawY])
  return { x, y, rawX, rawY }
}

// Mouse position relative to a ref element, normalised to [-0.5, 0.5]
export function useRelativeMouse(ref: React.RefObject<HTMLElement>) {
  const rx = useMotionValue(0)
  const ry = useMotionValue(0)
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!ref.current) return
      const r = ref.current.getBoundingClientRect()
      rx.set((e.clientX - r.left) / r.width - 0.5)
      ry.set((e.clientY - r.top) / r.height - 0.5)
    }
    window.addEventListener('mousemove', h)
    return () => window.removeEventListener('mousemove', h)
  }, [rx, ry, ref])
  return { rx, ry }
}

// ─── 3D Tilt card ──────────────────────────────────────────────────────────

export function use3DTilt(depth = 18) {
  const ref = useRef<HTMLDivElement>(null)
  const rx = useMotionValue(0)
  const ry = useMotionValue(0)
  const rotX = useSpring(rx, { stiffness: 200, damping: 25 })
  const rotY = useSpring(ry, { stiffness: 200, damping: 25 })

  const onMove = useCallback((e: React.MouseEvent) => {
    if (!ref.current) return
    const r = ref.current.getBoundingClientRect()
    const nx = (e.clientX - r.left) / r.width - 0.5
    const ny = (e.clientY - r.top) / r.height - 0.5
    ry.set(nx * depth)
    rx.set(-ny * depth)
  }, [rx, ry, depth])

  const onLeave = useCallback(() => { rx.set(0); ry.set(0) }, [rx, ry])

  return { ref, rotX, rotY, onMove, onLeave }
}

// ─── Magnetic button ───────────────────────────────────────────────────────

export function useMagnetic(strength = 0.35) {
  const ref = useRef<HTMLElement>(null)
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const x = useSpring(mx, { stiffness: 200, damping: 20 })
  const y = useSpring(my, { stiffness: 200, damping: 20 })

  const onMove = useCallback((e: React.MouseEvent) => {
    if (!ref.current) return
    const r = ref.current.getBoundingClientRect()
    mx.set((e.clientX - r.left - r.width / 2) * strength)
    my.set((e.clientY - r.top - r.height / 2) * strength)
  }, [mx, my, strength])

  const onLeave = useCallback(() => { mx.set(0); my.set(0) }, [mx, my])

  return { ref, x, y, onMove, onLeave }
}

// ─── Count-up animation ────────────────────────────────────────────────────

export function useCountUp(rawValue: string) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  const [displayed, setDisplayed] = useState('0')

  useEffect(() => {
    if (!inView) return
    // Extract leading number, preserve suffix (e.g. "3.2x" → num=3.2, suffix="x")
    const match = rawValue.match(/^([\d.]+)(.*)$/)
    if (!match) {
      // No leading number to count up  -  just show the raw value. Defer through a frame
      // so the state update never happens synchronously inside the effect (which would
      // risk a cascading re-render), exactly like the animated path below.
      const raf = requestAnimationFrame(() => setDisplayed(rawValue))
      return () => cancelAnimationFrame(raf)
    }
    const end = parseFloat(match[1])
    const suffix = match[2] ?? ''
    const decimals = (match[1].split('.')[1] ?? '').length
    const duration = 1400
    const startTime = Date.now()

    const tick = () => {
      const elapsed = Date.now() - startTime
      const p = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - p, 4)
      const current = eased * end
      setDisplayed(current.toFixed(decimals) + suffix)
      if (p < 1) requestAnimationFrame(tick)
      else setDisplayed(rawValue)
    }
    requestAnimationFrame(tick)
  }, [inView, rawValue])

  return { ref, displayed }
}

// ─── Scroll progress bar ───────────────────────────────────────────────────

export function ScrollProgressBar({ color = '#818cf8' }: { color?: string }) {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 })
  return (
    <motion.div
      style={{ scaleX, transformOrigin: 'left', background: color }}
      className="fixed top-0 left-0 right-0 h-[2px] z-[100]"
    />
  )
}

// ─── Clip-path image reveal ────────────────────────────────────────────────

interface ClipRevealProps {
  children: React.ReactNode
  className?: string
  delay?: number
  direction?: 'up' | 'down' | 'left' | 'right'
}

export function ClipReveal({ children, className = '', delay = 0, direction = 'up' }: ClipRevealProps) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })

  const variants = {
    up:    { hidden: 'inset(100% 0 0% 0)',    visible: 'inset(0% 0 0% 0)' },
    down:  { hidden: 'inset(0% 0 100% 0)',    visible: 'inset(0% 0 0% 0)' },
    left:  { hidden: 'inset(0% 0% 0% 100%)',  visible: 'inset(0% 0% 0% 0%)' },
    right: { hidden: 'inset(0% 100% 0% 0%)',  visible: 'inset(0% 0% 0% 0%)' },
  }
  const v = variants[direction]

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ clipPath: v.hidden }}
      animate={inView ? { clipPath: v.visible } : {}}
      transition={{ duration: 0.85, ease: 'easeOut', delay }}
    >
      {children}
    </motion.div>
  )
}

// ─── Parallax image ────────────────────────────────────────────────────────

export function ParallaxImage({
  src, alt, className = '', strength = 80, containerClassName = '',
}: {
  src: string; alt: string; className?: string; strength?: number; containerClassName?: string
}) {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], [-strength, strength])
  return (
    <div ref={ref} className={`overflow-hidden ${containerClassName}`}>
      <motion.img src={src} alt={alt} style={{ y }} className={`w-full h-full object-cover scale-110 ${className}`} />
    </div>
  )
}

// ─── Fade-slide in on scroll ───────────────────────────────────────────────

export function FadeUp({
  children, delay = 0, className = '', distance = 32,
}: { children: React.ReactNode; delay?: number; className?: string; distance?: number }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-50px' })
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: distance }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, ease: 'easeOut', delay }}
    >
      {children}
    </motion.div>
  )
}

// ─── Text reveal (line by line) ────────────────────────────────────────────

export function LineReveal({ text, className = '', delay = 0 }: { text: string; className?: string; delay?: number }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const lines = text.split('\n')
  return (
    <div ref={ref} className={className}>
      {lines.map((line, i) => (
        <div key={i} className="overflow-hidden">
          <motion.span
            className="block"
            initial={{ y: '110%' }}
            animate={inView ? { y: '0%' } : {}}
            transition={{ duration: 0.7, ease: 'easeOut', delay: delay + i * 0.08 }}
          >
            {line || ' '}
          </motion.span>
        </div>
      ))}
    </div>
  )
}

// ─── Cursor glow spotlight ────────────────────────────────────────────────

export function CursorGlow({ color = '#818cf8', size = 600, opacity = 0.12 }: {
  color?: string; size?: number; opacity?: number
}) {
  const { x, y } = useSmoothMouse(60, 18)
  return (
    <motion.div
      className="pointer-events-none fixed inset-0 -z-10"
      style={{
        background: useTransform(
          [x, y] as MotionValue[],
          ([cx, cy]) =>
            `radial-gradient(${size}px circle at ${cx as number}px ${cy as number}px, ${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}, transparent 60%)`,
        ),
      }}
    />
  )
}
