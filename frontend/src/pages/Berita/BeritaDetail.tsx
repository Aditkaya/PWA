import { useState, useEffect } from 'react';
import { useNavigate, useParams, useOutletContext } from 'react-router-dom';
import { ChevronLeft, Calendar, User, Lock } from 'lucide-react';
import './berita.css';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

interface BeritaDetail {
  id: number;
  judul: string;
  konten: string;
  tipe: 'berita' | 'pamflet';
  gambar: string | null;
  gambar_url: string | null;
  pinned: boolean;
  published_at: string | null;
  created_by_name: string | null;
}

function formatTanggal(dateStr: string | null): string {
  if (!dateStr) return '';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

export default function BeritaDetail() {
  const navigate       = useNavigate();
  const { id }         = useParams<{ id: string }>();
  const outlet = useOutletContext<{ featurePermissions?: Record<string, boolean> | null }>();
  const isDenied = outlet?.featurePermissions !== undefined && outlet?.featurePermissions !== null && outlet.featurePermissions['berita'] !== true;

  const [data, setData]       = useState<BeritaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!id || isDenied) return;
    setLoading(true);
    fetch(`${API_BASE}/api/berita/${id}`)
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          setData(json.data);
        } else {
          setError('Berita tidak ditemukan');
        }
      })
      .catch(() => setError('Tidak dapat terhubung ke server'))
      .finally(() => setLoading(false));
  }, [id, isDenied]);

  if (isDenied) {
    return (
      <div className="berita-detail-page">
        <div style={{ textAlign: 'center', padding: '60px 20px', maxWidth: '420px', margin: '40px auto' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Lock size={32} />
          </div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 8px', color: 'var(--text-primary)' }}>Akses Berita Dibatasi</h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 24px' }}>
            Anda tidak memiliki izin untuk melihat berita ini. Silakan hubungi tim IT untuk mendapatkan akses.
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

  if (loading) {
    return (
      <div className="berita-detail-page">
        <button className="berita-detail-back" onClick={() => navigate('/berita')}>
          <ChevronLeft size={18} /> Berita & Pamflet
        </button>
        <div style={{ padding: '30px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="skeleton-box" style={{ height: 200, borderRadius: 12 }} />
          <div className="skeleton-box" style={{ height: 18, width: '40%' }} />
          <div className="skeleton-box" style={{ height: 28, width: '90%' }} />
          <div className="skeleton-box" style={{ height: 14, width: '60%' }} />
          <div className="skeleton-box" style={{ height: 14, width: '80%' }} />
          <div className="skeleton-box" style={{ height: 14, width: '70%' }} />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="berita-detail-page">
        <button className="berita-detail-back" onClick={() => navigate('/berita')}>
          <ChevronLeft size={18} /> Berita & Pamflet
        </button>
        <div className="berita-empty">
          <div className="berita-empty-icon">⚠️</div>
          <p>{error ?? 'Berita tidak ditemukan'}</p>
          <button onClick={() => navigate('/berita')}
            style={{ marginTop: 8, padding: '8px 20px', borderRadius: 10, border: '1.5px solid #6366f1',
              background: 'none', color: '#6366f1', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}>
            Kembali ke Daftar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="berita-detail-page">
      {/* Back nav */}
      <button className="berita-detail-back" onClick={() => navigate('/berita')}>
        <ChevronLeft size={18} /> Berita & Pamflet
      </button>

      {/* Hero image */}
      {data.gambar_url && (
        <img
          src={data.gambar_url}
          alt={data.judul}
          className="berita-detail-hero"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      )}

      {/* Body */}
      <div className="berita-detail-body">
        {/* Badges */}
        <div className="berita-detail-badges">
          <span className={`badge-tipe ${data.tipe === 'pamflet' ? 'badge-pamflet' : 'badge-berita'}`}>
            {data.tipe === 'pamflet' ? '🖼️ Pamflet' : '📰 Berita'}
          </span>
          {data.pinned && <span style={{ fontSize: '0.8rem' }}>📌 Penting</span>}
        </div>

        {/* Judul */}
        <h1 className="berita-detail-title">{data.judul}</h1>

        {/* Meta */}
        <div className="berita-detail-meta">
          <Calendar size={12} />
          {formatTanggal(data.published_at)}
          {data.created_by_name && (
            <>
              <span style={{ opacity: 0.4 }}>·</span>
              <User size={12} />
              {data.created_by_name}
            </>
          )}
        </div>

        <div className="berita-detail-divider" />

        {/* Konten */}
        {data.konten ? (
          <div className="berita-detail-konten">{data.konten}</div>
        ) : (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontStyle: 'italic' }}>
            Tidak ada konten teks.
          </p>
        )}
      </div>
    </div>
  );
}