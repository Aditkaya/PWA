import { useEffect, useState, type CSSProperties } from 'react'
import { useSnowStore } from '../store/snow.store'
import '../styles/snowfall.css'

// Fixed variation keeps the decoration stable across navigation and renders.
const flakes = Array.from({ length: 36 }, (_, index) => ({
  left: `${((index * 37) % 100) + 0.5}%`,
  '--snow-size': `${10 + (index % 5) * 2}px`,
  '--snow-drift': `${((index * 13) % 65) - 32}px`,
  '--snow-opacity': 0.22 + (index % 5) * 0.09,
  animationDuration: `${11 + (index % 9)}s`,
  animationDelay: `${-((index * 7) % 23)}s`,
} as CSSProperties))

export default function Snowfall({ fullWidth = false }: { fullWidth?: boolean }) {
  const enabled = useSnowStore(state => state.enabled)
  const [hidden, setHidden] = useState(document.hidden)
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onMotionChange = () => setReducedMotion(media.matches)
    const onVisibilityChange = () => setHidden(document.hidden)
    media.addEventListener('change', onMotionChange)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      media.removeEventListener('change', onMotionChange)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  if (!enabled || reducedMotion || hidden) return null

  return (
    <div className={`pwa-snowfall${fullWidth ? ' pwa-snowfall--full' : ''}`} aria-hidden="true">
      {flakes.map((style, index) => <span className="pwa-snowflake" style={style} key={index}>{['❄', '❅', '❆'][index % 3]}</span>)}
    </div>
  )
}
