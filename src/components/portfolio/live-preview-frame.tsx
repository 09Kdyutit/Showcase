'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { THEME_COMPONENTS } from './themes'
import type { ThemeId } from '@/lib/portfolio/themes'
import type { ThemeContent, ThemePortfolio } from './themes/shared'

interface LivePreviewFrameProps {
  themeId: ThemeId
  portfolio: ThemePortfolio
  content: ThemeContent
  height?: number
}

const DESIGN_WIDTH = 1280

/**
 * Renders the *real* theme component at a shrunk scale, instead of a hand-built mini mockup
 * that can drift from what actually publishes. Uses CSS `zoom` rather than `transform:
 * scale` — zoom reflows layout at the scaled size, so the outer frame's native scrollbar
 * works correctly against the shrunk content's real height; `transform` would need separate
 * height measurement to make scrolling behave right.
 */
export function LivePreviewFrame({ themeId, portfolio, content, height = 640 }: LivePreviewFrameProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.42)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setScale(Math.max(0.25, el.clientWidth / DESIGN_WIDTH))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const ThemeComponent = THEME_COMPONENTS[themeId]
  const zoomStyle: CSSProperties & { zoom?: number } = { width: DESIGN_WIDTH, zoom: scale }

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-xl border border-border overflow-y-auto overflow-x-hidden bg-background"
      style={{ height }}
    >
      <div style={zoomStyle}>
        <ThemeComponent portfolio={portfolio} content={content} />
      </div>
    </div>
  )
}
