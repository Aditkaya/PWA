import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Newspaper, Image as ImageIcon, ArrowLeft, Lock } from 'lucide-react';
import './berita.css';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

interface BeritaItem {
  id: number;
  judul: string;
  konten: string;
  konten_singkat: string;
  tipe: 'berita' | 'pamflet';
  gambar: string | null;
  gambar_url: string | null;
  pinned: boolean;
  published_at: string | null;
  created_by_name: string | null;
}

type FilterTipe = 'semua' | 'berita' | 'pamflet';

function formatTanggal(dateStr: string | null): string {
  if (!dateStr) return '';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit', month: 'long', year: 'numeric',
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

function SkeletonCard() {
  return (
    <div className="berita-skeleton">
      <div className="skeleton-box" style={{ width: 72, height: 56, flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="skeleton-box" style={{ height: 12, width: '60%' }} />
        <div className="skeleton-box" style={{ height: 16, width: '90%' }} />
        <div className="skeleton-box" style={{ height: 12, width: '75%' }} />
      </div>
    </div>
  );
}

export default function Berita() {
  const navigate = useNavigate();
  const outlet = useOutletContext<{ featurePermissions?: Record<string, boolean> | null }>();
  const isDenied = outlet?.featurePermissions !== undefined && outlet?.featurePermissions !== null && outlet.featurePermissions['berita'] !== true;

  const [filter, setFilter]       = useState<FilterTipe>('semua');
  const [beritas, setBeritas]     = useState<BeritaItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  const fetchBeritas = useCallback(async (tipe: FilterTipe) => {
    setLoading(true);
    setError(null);
    try {
      const url = tipe === 'semua'
        ? `${API_BASE}/api/berita?limit=30`
        : `${API_BASE}/api/berita?tipe=${tipe}&limit=30`;
      const res  = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setBeritas(json.data ?? []);
      } else {
        setError('Gagal memuat berita');
      }
    } catch {
      setError('Tidak dapat terhubung ke server');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { 
    if (!isDenied) {
      fetchBeritas(filter); 
    }
  }, [filter, fetchBeritas, isDenied]);

  if (isDenied) {
    return (
      <div className="berita-page">
        <div style={{ textAlign: 'center', padding: '60px 20px', maxWidth: '420px', margin: '40px auto' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Lock size={32} />
          </div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 8px', color: 'var(--text-primary)' }}>Akses Berita Dibatasi</h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 24px' }}>
            Anda tidak memiliki izin untuk melihat menu Berita. Silakan hubungi tim IT jika Anda memerlukan akses ke fitur ini.
          </p>
          <button 
            onClick={() => navigate('/')}
            style={{ padding: '10px 24px', borderRadius: '12px', background: 'var(--accent-color, #38bdf8)', color: '#000', fontWeight: 600, border: 'none', cursor: 'pointer' }}
          >
            Kembali ke Beranda
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="berita-page">
      {/* Header */}
      <div className="berita-header">
        <button
          onClick={() => navigate('/')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 8px',
            display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: '0.8rem' }}
        >
          <ArrowLeft size={15} /> Kembali
        </button>
        <h1>📰 Berita & Pamflet</h1>
        <p>Informasi & pengumuman terbaru dari perusahaan</p>
      </div>

      {/* Filter tabs */}
      <div className="berita-tabs">
        {(['semua', 'berita', 'pamflet'] as FilterTipe[]).map(t => (
          <button
            key={t}
            className={`berita-tab ${filter === t ? 'active' : ''}`}
            onClick={() => setFilter(t)}
          >
            {t === 'semua' ? 'Semua' : t === 'berita' ? '📰 Berita' : '🖼️ Pamflet'}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="berita-grid">
          {[1,2,3,4].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : error ? (
        <div className="berita-empty">
          <div className="berita-empty-icon">⚠️</div>
          <p>{error}</p>
          <button onClick={() => fetchBeritas(filter)}
            style={{ marginTop: 8, padding: '8px 20px', borderRadius: 10, border: '1.5px solid #6366f1',
              background: 'none', color: '#6366f1', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}>
            Coba Lagi
          </button>
        </div>
      ) : beritas.length === 0 ? (
        <div className="berita-empty">
          <div className="berita-empty-icon">📭</div>
          <p>Belum ada {filter === 'semua' ? 'berita' : filter}</p>
          <span>Pantau terus untuk informasi terbaru</span>
        </div>
      ) : (
        <div className="berita-grid">
          {beritas.map(item => (
            <button
              key={item.id}
              className={`berita-card ${item.tipe === 'pamflet' ? 'berita-card-pamflet' : ''} ${item.pinned ? 'berita-card-pinned' : ''}`}
              onClick={() => navigate(`/berita/${item.id}`)}
            >
              {item.tipe === 'pamflet' ? (
                // Pamflet — full-width image card
                <>
                  {item.gambar_url ? (
                    <img src={item.gambar_url} alt={item.judul} className="berita-card-img" style={{ width: '100%', height: 180, borderRadius: '14px 14px 0 0' }}
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : (
                    <div style={{ width: '100%', height: 100, background: 'var(--glass-bg)', borderRadius: '14px 14px 0 0',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>🖼️</div>
                  )}
                  <div className="berita-card-body">
                    <div className="berita-card-badges">
                      <span className="badge-tipe badge-pamflet"><ImageIcon size={9} /> Pamflet</span>
                      {item.pinned && <span className="badge-pin">📌</span>}
                    </div>
                    <p className="berita-card-title">{item.judul}</p>
                    {item.konten_singkat && <p className="berita-card-snippet">{item.konten_singkat}</p>}
                    <p className="berita-card-date">{formatTanggal(item.published_at)}</p>
                  </div>
                </>
              ) : (
                // Berita — row layout
                <>
                  {item.gambar_url ? (
                    <img src={item.gambar_url} alt={item.judul} className="berita-card-img"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : (
                    <div className="berita-card-img-placeholder">📰</div>
                  )}
                  <div className="berita-card-body">
                    <div className="berita-card-badges">
                      <span className="badge-tipe badge-berita"><Newspaper size={9} /> Berita</span>
                      {item.pinned && <span className="badge-pin">📌</span>}
                    </div>
                    <p className="berita-card-title">{item.judul}</p>
                    {item.konten_singkat && <p className="berita-card-snippet">{item.konten_singkat}</p>}
                    <p className="berita-card-date">{formatTanggal(item.published_at)}</p>
                  </div>
                </>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}