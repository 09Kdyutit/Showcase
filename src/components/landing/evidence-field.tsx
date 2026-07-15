'use client'

import { useEffect, useRef } from 'react'

/**
 * The Evidence Field — the landing hero's signature scene.
 *
 * A living canvas of résumé-claim fragments drifting in three depth layers with
 * cursor parallax. Every few seconds one fragment near the middle is "caught":
 * it brightens to verified green, a tick appears, and a luminous trail draws from
 * it down into the proof engine (the assembly card below the CTAs). The product's
 * entire promise — floating unproven claims becoming evidence — told ambiently.
 *
 * Craft notes: DPR-aware, pauses off-screen and on hidden tabs, throttled to rAF,
 * ~26 lightweight text draws per frame. prefers-reduced-motion renders one static
 * frame and never animates. Mobile gets a sparser field and no parallax.
 */

const PHRASES = [
  'led a team', 'improved performance', 'shipped features', 'increased engagement',
  'reduced costs', 'built a dashboard', 'managed stakeholders', 'drove adoption',
  'launched a product', 'mentored interns', 'redesigned onboarding', 'scaled the pipeline',
  'automated reporting', 'cut load times', 'grew retention', 'ran user research',
  'migrated the API', 'owned delivery', 'streamlined ops', 'boosted conversion',
  'fixed critical bugs', 'presented to execs', 'analyzed the funnel', 'wrote documentation',
  'tested hypotheses', 'closed the gap',
]

interface Fragment {
  text: string
  x: number       // 0..1 of width
  y: number       // 0..1 of height
  depth: number   // 0 (far) .. 1 (near)
  vx: number
  vy: number
  phase: number   // for gentle bob
}

interface Verification {
  frag: Fragment
  start: number   // ms timestamp
}

const VERIFY_EVERY_MS = 3200
const VERIFY_DURATION = 2600

export function EvidenceField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const mobile = window.innerWidth < 640
    const count = mobile ? 14 : PHRASES.length

    // Seeded-ish layout: scatter fragments, keeping the headline center clearer
    const frags: Fragment[] = []
    for (let i = 0; i < count; i++) {
      const depth = i % 3 === 0 ? 0.15 : i % 3 === 1 ? 0.5 : 0.9
      let x = Math.random()
      const y = Math.random()
      // push out of the central headline zone
      if (x > 0.28 && x < 0.72 && y > 0.22 && y < 0.62) {
        x = x < 0.5 ? x - 0.26 : x + 0.26
      }
      frags.push({
        text: PHRASES[i % PHRASES.length],
        x: Math.min(0.97, Math.max(0.02, x)),
        y: Math.min(0.92, Math.max(0.05, y)),
        depth,
        vx: (Math.random() - 0.5) * 0.000018,
        vy: (Math.random() - 0.5) * 0.000012,
        phase: Math.random() * Math.PI * 2,
      })
    }

    let W = 0, H = 0, dpr = 1
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      W = canvas.clientWidth
      H = canvas.clientHeight
      canvas.width = W * dpr
      canvas.height = H * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()

    let mx = 0.5, my = 0.4
    const onMove = (e: MouseEvent) => {
      mx = e.clientX / window.innerWidth
      my = e.clientY / window.innerHeight
    }
    if (!mobile) window.addEventListener('mousemove', onMove, { passive: true })

    // The proof-engine anchor the trails feed into (center, below the CTAs)
    const anchor = () => ({ ax: W * 0.5, ay: H * 0.86 })

    let verification: Verification | null = null
    let lastVerify = performance.now() + 1200 // first catch shortly after load

    const pickFragment = () => {
      // prefer nearer, more central fragments so the catch is visible
      const candidates = frags.filter(f => f.depth > 0.4 && f.y < 0.75)
      return candidates[Math.floor(Math.random() * candidates.length)] ?? frags[0]
    }

    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

    const drawFrame = (now: number, animate: boolean) => {
      ctx.clearRect(0, 0, W, H)
      const { ax, ay } = anchor()

      // parallax offsets by depth
      const px = (mx - 0.5), py = (my - 0.5)

      for (const f of frags) {
        if (animate) {
          f.x += f.vx * 16
          f.y += f.vy * 16
          if (f.x < 0.01 || f.x > 0.99) f.vx *= -1
          if (f.y < 0.03 || f.y > 0.95) f.vy *= -1
        }
        const bob = animate ? Math.sin(now / 2400 + f.phase) * 3 : 0
        const ox = mobile ? 0 : px * f.depth * 46
        const oy = mobile ? 0 : py * f.depth * 26
        const x = f.x * W + ox
        const y = f.y * H + oy + bob

        const isV = verification?.frag === f
        let alpha = 0.10 + f.depth * 0.16
        let color = `rgba(191, 219, 254, ${alpha})` // faint blue-white
        let size = 10 + f.depth * 4
        let tick = 0

        if (isV && verification) {
          const t = Math.min((now - verification.start) / VERIFY_DURATION, 1)
          // brighten in, hold, fade out
          const pulse = t < 0.25 ? easeOut(t / 0.25) : t > 0.78 ? 1 - easeOut((t - 0.78) / 0.22) : 1
          alpha = 0.10 + f.depth * 0.16 + pulse * 0.75
          color = `rgba(52, 211, 153, ${alpha})`
          size += pulse * 1.5
          tick = t > 0.3 ? Math.min((t - 0.3) / 0.15, 1) * pulse : 0

          // luminous trail: quadratic bezier from fragment into the proof engine
          const draw = t < 0.6 ? easeOut(t / 0.6) : 1
          const fade = t > 0.78 ? 1 - (t - 0.78) / 0.22 : 1
          if (draw > 0.02 && fade > 0.02) {
            const cx = (x + ax) / 2 + (x < ax ? 60 : -60)
            const cy = (y + ay) / 2 - 40
            ctx.save()
            ctx.strokeStyle = `rgba(52, 211, 153, ${0.5 * fade})`
            ctx.lineWidth = 1.25
            ctx.setLineDash([4, 5])
            ctx.shadowColor = 'rgba(52, 211, 153, 0.8)'
            ctx.shadowBlur = 6
            ctx.beginPath()
            // draw partial bezier by sampling
            const steps = 36
            const upto = Math.floor(steps * draw)
            for (let s = 0; s <= upto; s++) {
              const u = s / steps
              const bx = (1 - u) * (1 - u) * x + 2 * (1 - u) * u * cx + u * u * ax
              const by = (1 - u) * (1 - u) * y + 2 * (1 - u) * u * cy + u * u * ay
              if (s === 0) ctx.moveTo(bx, by)
              else ctx.lineTo(bx, by)
            }
            ctx.stroke()
            ctx.restore()
            // arrival glow at the engine
            if (draw === 1) {
              ctx.save()
              ctx.fillStyle = `rgba(52, 211, 153, ${0.35 * fade})`
              ctx.shadowColor = 'rgba(52, 211, 153, 0.9)'
              ctx.shadowBlur = 14
              ctx.beginPath()
              ctx.arc(ax, ay, 3.2, 0, Math.PI * 2)
              ctx.fill()
              ctx.restore()
            }
          }
        }

        ctx.font = `${size}px ui-monospace, SFMono-Regular, Menlo, monospace`
        ctx.fillStyle = color
        ctx.textAlign = 'center'
        if (isV) {
          ctx.save()
          ctx.shadowColor = 'rgba(52, 211, 153, 0.7)'
          ctx.shadowBlur = 10
        }
        ctx.fillText(f.text, x, y)
        if (isV) ctx.restore()
        if (tick > 0) {
          ctx.fillStyle = `rgba(52, 211, 153, ${tick})`
          ctx.fillText('✓', x + ctx.measureText(f.text).width / 2 + 12, y)
        }
      }
    }

    if (reduce) {
      // one calm, static frame — no motion at all
      drawFrame(performance.now(), false)
      const ro = new ResizeObserver(() => { resize(); drawFrame(performance.now(), false) })
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    let raf = 0
    let running = true
    const loop = (now: number) => {
      if (!running) return
      if (!verification && now - lastVerify > VERIFY_EVERY_MS) {
        verification = { frag: pickFragment(), start: now }
      }
      if (verification && now - verification.start > VERIFY_DURATION) {
        verification = null
        lastVerify = now
      }
      drawFrame(now, true)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    // pause when off-screen or tab hidden — zero cost when not visible
    const io = new IntersectionObserver(([entry]) => {
      const visible = entry.isIntersecting && document.visibilityState === 'visible'
      if (visible && !running) { running = true; raf = requestAnimationFrame(loop) }
      else if (!visible) { running = false; cancelAnimationFrame(raf) }
    }, { threshold: 0.05 })
    io.observe(canvas)
    const onVis = () => {
      if (document.visibilityState === 'hidden') { running = false; cancelAnimationFrame(raf) }
      else if (!running) { running = true; raf = requestAnimationFrame(loop) }
    }
    document.addEventListener('visibilitychange', onVis)

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      io.disconnect()
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      if (!mobile) window.removeEventListener('mousemove', onMove)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 1 }}
    />
  )
}
