'use client'

import { useEffect, useState } from 'react'

/**
 * Tracks the current visual viewport height in real time.
 *
 * WHY THIS EXISTS
 * ───────────────
 * On iOS Safari, when the on-screen keyboard opens the browser does NOT resize
 * the layout viewport. CSS units like `vh` and `dvh` are tied to the layout
 * viewport and therefore do NOT shrink when the keyboard appears (or shrink
 * only after a delay, after the keyboard animation has fully completed).
 *
 * window.visualViewport.height IS the real available height above the keyboard,
 * updated synchronously as the keyboard animates. It is the only reliable way
 * to size a chat container so the input bar sits immediately above the keyboard
 * rather than behind it.
 *
 * USAGE
 * ─────
 * Apply the returned value as an inline `height` style on the outermost
 * full-screen container. The inline style has higher specificity than the
 * Tailwind `h-[100dvh]` fallback class, so it takes over on mobile while
 * the CSS class acts as the SSR / no-JS default:
 *
 *   const vpHeight = useVisualViewport()
 *   <div
 *     className="flex h-[100dvh] overflow-hidden"
 *     style={vpHeight !== null ? { height: `${vpHeight}px` } : undefined}
 *   >
 *
 * FALLBACK CHAIN
 * ──────────────
 * 1. SSR / hydration                → returns null → CSS class h-[100dvh] is used
 * 2. window.visualViewport present  → returns vv.height, updated on resize + scroll
 * 3. visualViewport absent          → falls back to window.innerHeight
 */
export function useVisualViewport(): number | null {
  const [vpHeight, setVpHeight] = useState<number | null>(null)

  useEffect(() => {
    const vv = window.visualViewport

    if (vv) {
      // Primary path: visualViewport API available (iOS Safari, Chrome mobile)
      const update = () => setVpHeight(vv.height)
      update()
      vv.addEventListener('resize', update)
      // iOS also fires 'scroll' on the visual viewport when the browser pans
      // the page to reveal a focused input — listen to that too.
      vv.addEventListener('scroll', update)
      return () => {
        vv.removeEventListener('resize', update)
        vv.removeEventListener('scroll', update)
      }
    }

    // Fallback: visualViewport not available (older desktop browsers)
    const update = () => setVpHeight(window.innerHeight)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return vpHeight
}
