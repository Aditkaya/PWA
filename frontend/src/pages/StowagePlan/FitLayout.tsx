import { useLayoutEffect, useRef } from 'react'
import type { ReactNode } from 'react'

/** Fit the entire natural-size layout, including the hull, into one viewport. */
export default function FitLayout({ children, ocean }: { children: ReactNode; ocean: boolean }) {
  const viewport = useRef<HTMLDivElement>(null)
  const drawing = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const frame = viewport.current!
    const content = drawing.current!
    let animation = 0
    const fit = () => {
      cancelAnimationFrame(animation)
      animation = requestAnimationFrame(() => {
        const width = frame.clientWidth - 16
        const height = frame.clientHeight - 16
        const naturalWidth = content.offsetWidth
        const naturalHeight = content.offsetHeight
        if (width <= 0 || height <= 0 || !naturalWidth || !naturalHeight) return
        const scale = Math.min(1, width / naturalWidth, height / naturalHeight)
        content.style.transform = `translate(${(frame.clientWidth - naturalWidth * scale) / 2}px, ${(frame.clientHeight - naturalHeight * scale) / 2}px) scale(${scale})`
        content.style.visibility = 'visible'
      })
    }
    const observer = new ResizeObserver(fit)
    observer.observe(frame)
    observer.observe(content)
    fit()
    return () => { observer.disconnect(); cancelAnimationFrame(animation) }
  }, [])

  return <div ref={viewport} className={`sp-grid sp-fit-viewport ${ocean ? 'sp-ocean' : ''}`} role="region" aria-label="Seluruh layout kapal, otomatis sesuai ukuran layar">
    <div ref={drawing} className="sp-fit-drawing">{children}</div>
  </div>
}
