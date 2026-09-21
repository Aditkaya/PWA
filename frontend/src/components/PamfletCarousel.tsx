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
      <div style={{ paddingBottom: 4 }}>
        <div style={{
          width: '100%',
          aspectRatio: '2.1 / 1',
          minHeight: 150,
          maxHeight: 200,
          borderRadius: 18,
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
        onClick={() => navigate(current.id ? `/berita/${current.id}` : '/berita')}
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '2.2 / 1',
          minHeight: 140,
          maxHeight: 200,
          borderRadius: 16,
          background: current.gambar_url ? '#0b1120' : bg,
          cursor: 'pointer',
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          userSelect: 'none',
          transition: 'all 0.3s ease',
        }}
      >
        {current.gambar_url ? (
          <>
            {/* Clean Full-width Banner Image */}
            <img
              src={current.gambar_url}
              alt={current.judul}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none'
              }}
            />

            {/* Subtle slide counter pill if multiple pamflets */}
            {pamflets.length > 1 && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 8,
                  right: 10,
                  zIndex: 2,
                  padding: '2px 8px',
                  borderRadius: 10,
                  background: 'rgba(0, 0, 0, 0.5)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  letterSpacing: '0.5px',
                  pointerEvents: 'none',
                }}
              >
                {activeIndex + 1} / {pamflets.length}
              </div>
            )}
          </>
        ) : (
          /* Text-only banner when no image is uploaded */
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxSizing: 'border-box',
            }}
          >
            {/* Decorative circles */}
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

            <div style={{ zIndex: 1 }}>
              <span
                style={{
                  display: 'inline-block',
                  fontSize: '0.66rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  padding: '2px 8px',
                  borderRadius: 6,
                  background: 'rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
                  marginBottom: 6,
                }}
              >
                📢 Informasi
              </span>
              <p
                style={{
                  margin: 0,
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  color: '#ffffff',
                  lineHeight: 1.35,
                  textShadow: '0 1px 4px rgba(0,0,0,0.3)',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  lineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {current.judul}
              </p>
            </div>

            <div style={{ zIndex: 1 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  color: 'rgba(255, 255, 255, 0.85)',
                }}
              >
                Lihat selengkapnya <ExternalLink size={11} />
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Modern Minimalist Dot indicators */}
      {pamflets.length > 1 && (
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 5,
          marginTop: 8,
        }}>
          {pamflets.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              style={{
                width: i === activeIndex ? 16 : 5,
                height: 4,
                borderRadius: 2,
                background: i === activeIndex ? 'var(--accent-color)' : 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                transition: 'all 0.3s ease',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
