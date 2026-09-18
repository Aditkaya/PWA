import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'

interface PamfletItem {
  id: number
  judul: string
  konten_singkat: string
  gambar_url: string | null
  published_at: string | null
}

// Warna background per-slide (berulang jika lebih dari palette)
const SLIDE_COLORS = [
  'linear-gradient(135deg, #c0392b 0%, #96281b 100%)',
  'linear-gradient(135deg, #1a237e 0%, #283593 100%)',
  'linear-gradient(135deg, #1b5e20 0%, #2e7d32 100%)',
  'linear-gradient(135deg, #4a148c 0%, #6a1b9a 100%)',
  'linear-gradient(135deg, #e65100 0%, #bf360c 100%)',
  'linear-gradient(135deg, #006064 0%, #00838f 100%)',
]

export default function PamfletCarousel() {
  const navigate = useNavigate()
  const [pamflets, setPamflets] = useState<PamfletItem[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const trackRef = useRef<HTMLDivElement>(null)

  // Touch/swipe state
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)

  useEffect(() => {
    fetch('/api/berita?tipe=pamflet&limit=10')
      .then(r => r.json())
      .then(json => {
        if (json.success) setPamflets(json.data ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Auto-advance every 5 seconds
  useEffect(() => {
    if (pamflets.length < 2) return
    const timer = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % pamflets.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [pamflets.length])

  const goTo = (index: number) => setActiveIndex(index)

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    // Only swipe if horizontal movement is dominant
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      if (dx < 0) setActiveIndex(i => Math.min(i + 1, pamflets.length - 1))
      else setActiveIndex(i => Math.max(i - 1, 0))
    }
    touchStartX.current = null
    touchStartY.current = null
  }

  if (loading) {
    return (
      <div style={{ padding: '0 0 16px 0' }}>
        <div style={{
          height: 130, borderRadius: 16,
          background: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
          animation: 'shimmer 1.5s infinite ease-in-out',
        }} />
      </div>
    )
  }

  if (pamflets.length === 0) return null

  const current = pamflets[activeIndex]
  const bg = SLIDE_COLORS[activeIndex % SLIDE_COLORS.length]

  return (
    <div style={{ paddingBottom: 4 }}>
      {/* Carousel track */}
      <div
        ref={trackRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={() => navigate('/berita')}
        style={{
          position: 'relative',
          borderRadius: 18,
          background: bg,
          padding: '20px 20px 20px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          cursor: 'pointer',
          overflow: 'hidden',
          minHeight: 120,
          boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
          userSelect: 'none',
          transition: 'background 0.4s ease',
        }}
      >
        {/* Decorative circle bg */}
        <div style={{
          position: 'absolute', right: -20, bottom: -30,
          width: 150, height: 150, borderRadius: '50%',
          background: 'rgba(255,255,255,0.07)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', right: 60, top: -40,
          width: 100, height: 100, borderRadius: '50%',
          background: 'rgba(255,255,255,0.05)',
          pointerEvents: 'none',
        }} />

        {/* Text side */}
        <div style={{ flex: 1, zIndex: 1 }}>
          <p style={{
            margin: '0 0 8px 0',
            fontSize: '0.97rem',
            fontWeight: 700,
            color: '#ffffff',
            lineHeight: 1.35,
            textShadow: '0 1px 4px rgba(0,0,0,0.3)',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {current.judul}
          </p>
          <button
            onClick={(e) => { e.stopPropagation(); navigate('/berita') }}
            style={{
              padding: '5px 14px',
              background: '#fbbf24',
              color: '#1a1a1a',
              border: 'none',
              borderRadius: 20,
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              whiteSpace: 'nowrap',
            }}
          >
            <ExternalLink size={12} />
            Lihat selengkapnya
          </button>
        </div>

        {/* Image side */}
        {current.gambar_url && (
          <div style={{
            flexShrink: 0,
            width: 90,
            height: 90,
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            zIndex: 1,
          }}>
            <img
              src={current.gambar_url}
              alt={current.judul}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          </div>
        )}
      </div>

      {/* Dot indicators */}
      {pamflets.length > 1 && (
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 6,
          marginTop: 10,
        }}>
          {pamflets.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              style={{
                width: i === activeIndex ? 20 : 7,
                height: 7,
                borderRadius: 4,
                background: i === activeIndex ? 'var(--accent-color)' : 'var(--glass-border)',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                transition: 'width 0.3s ease, background 0.3s ease',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
