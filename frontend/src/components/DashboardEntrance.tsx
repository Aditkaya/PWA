import { useEffect, useState } from 'react'
import Dashboard from '../pages/Dashboard/Dashboard'

const ENTRANCE_DURATION_MS = 2500
const FADE_DURATION_MS = 300

export default function DashboardEntrance() {
  // The HTML loader already covers the first visit or a full page refresh.
  const [phase, setPhase] = useState<'loading' | 'hiding' | 'ready'>(() =>
    document.getElementById('ayp-loader') ? 'ready' : 'loading'
  )

  useEffect(() => {
    if (phase !== 'loading') return
    const timer = window.setTimeout(() => setPhase('hiding'), ENTRANCE_DURATION_MS)
    return () => window.clearTimeout(timer)
  }, [phase])

  useEffect(() => {
    if (phase !== 'hiding') return
    const timer = window.setTimeout(() => setPhase('ready'), FADE_DURATION_MS)
    return () => window.clearTimeout(timer)
  }, [phase])

  if (phase === 'ready') return <Dashboard />

  return (
    <>
      {phase === 'hiding' && <Dashboard />}
      <div className={`ayp-loader${phase === 'hiding' ? ' is-hidden' : ''}`} role="status" aria-label="Loading Dashboard">
        <div className="ayp-loader__box">
          <div className="ayp-loader__visual">
            <span className="ayp-loader__ring" aria-hidden="true" />
            <img className="ayp-loader__logo" src="/ayp-logo-transparent.png" alt="AYP" />
          </div>
          <div className="ayp-loader__text">Loading<span className="ayp-loader__dots" /></div>
        </div>
      </div>
    </>
  )
}
