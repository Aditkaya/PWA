import { useEffect, useState } from 'react'
import { ArrowLeft, Camera, CheckCircle2, ChevronDown, ChevronUp, ClipboardCheck, Image, RefreshCw, Search } from 'lucide-react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useAuthStore } from '../../store/auth.store'
import { useToast } from '../../contexts/ToastContext'
import AssetPhotoCamera from './AssetPhotoCamera'
import AssetReceiptViewer from './AssetReceiptViewer'
import AssetReturns from './AssetReturns'
import './TandaTerimaAsset.css'

interface AssetReceipt {
  id: number
  kode_asset: string
  nama_asset: string
  nama_merk: string | null
  kategori: string
  nomor_seri: string | null
  kondisi: string
  status: string
  lokasi: string | null
  nama_pemegang: string | null
  nik_pemegang: string | null
  departemen_pemegang: string | null
  tanggal_tanda_terima: string | null
  keterangan: string | null
  has_foto: number | boolean
}

function formatDate(value: string | null) {
  if (!value || value.startsWith('0000-00-00')) return '—'
  const date = new Date(value.slice(0, 10) + 'T00:00:00')
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function TandaTerimaAsset() {
  const navigate = useNavigate()
  const userId = useAuthStore(state => state.user?.id)
  const token = useAuthStore(state => state.token)
  const { showToast } = useToast()
  const [cameraAsset, setCameraAsset] = useState<AssetReceipt | null>(null)
  const [viewer, setViewer] = useState<{ id: number } | null>(null)
  const [section, setSection] = useState<'assets' | 'returns'>('assets')
  const { featurePermissions } = useOutletContext<{
    featurePermissions: Record<string, boolean> | null
  }>()
  const accessDenied = featurePermissions?.['tanda_terima_asset'] === false
  const [rows, setRows] = useState<AssetReceipt[]>([])
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0, per_page: 25 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [expandedAssets, setExpandedAssets] = useState<Set<number>>(() => new Set())

  const toggleAssetDetails = (id: number) => {
    setExpandedAssets(previous => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  useEffect(() => {
    if (accessDenied || !userId) return
    const controller = new AbortController()
    setLoading(true)
    setError('')
    const params = new URLSearchParams({ page: String(page), search: query })
    fetch(`/api/tanda-terima-asset?${params}`, { signal: controller.signal, cache: 'no-store', headers: { Authorization: `Bearer ${token || ''}` } })
      .then(async response => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.message || 'Gagal memuat data tanda terima asset.')
        if (!Array.isArray(result.data) || !result.meta) throw new Error('Respons data tanda terima asset tidak valid.')
        return result
      })
      .then(result => { setRows(result.data); setMeta(result.meta) })
      .catch(reason => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Gagal terhubung ke server.')
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [accessDenied, userId, token, page, query, refresh])

  const savePhoto = async (photo: Blob) => {
    if (!cameraAsset) return
    const form = new FormData()
    form.append('foto', photo, 'asset.jpg')
    const response = await fetch(`/api/tanda-terima-asset/${cameraAsset.id}/foto`, {
      method: 'POST', headers: { Authorization: `Bearer ${token || ''}` }, body: form,
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.message || 'Foto gagal disimpan.')
    showToast(result.message || 'Foto asset berhasil disimpan.', 'success')
    setCameraAsset(null)
    setRefresh(value => value + 1)
  }

  return (
    <section className="asset-receipt-page">
      <div className="asset-receipt-card fade-in">
        <button className="asset-receipt-back" onClick={() => navigate('/')}>
          <ArrowLeft size={18} /> Kembali ke Beranda
        </button>
        <div className="asset-receipt-heading">
          <ClipboardCheck size={32} className="asset-receipt-icon" />
          <div><h1>Tanda Terima Asset</h1><p>Daftar asset yang tercatat atas nama Anda.</p></div>
        </div>
        {accessDenied || !userId ? (
          <p role="alert">{accessDenied ? 'Anda belum memiliki akses ke menu ini. Hubungi IT untuk pengaturan akses.' : 'Silakan login kembali untuk melihat data.'}</p>
        ) : <>
          <div className="asset-receipt-tabs" aria-label="Menu tanda terima asset">
            <button aria-pressed={section === 'assets'} onClick={() => setSection('assets')}>Asset Anda</button>
            <button aria-pressed={section === 'returns'} onClick={() => setSection('returns')}>Pengembalian Asset</button>
          </div>
          {section === 'returns' ? <AssetReturns token={token} /> : <>
          <div className="asset-receipt-guide">
            <span><span className="asset-receipt-step">1</span> Pilih asset Anda</span>
            <span><span className="asset-receipt-step">2</span> Ambil &amp; simpan foto</span>
            <span><span className="asset-receipt-step">3</span> Lihat foto bukti serah terima</span>
          </div>
          <form className="asset-receipt-toolbar" onSubmit={event => { event.preventDefault(); setPage(1); setQuery(search.trim()); setRefresh(value => value + 1) }}>
            <label className="asset-receipt-search">
              <Search size={18} aria-hidden="true" />
              <input aria-label="Cari asset Anda" placeholder="Cari nama atau kode asset..." value={search} onChange={event => setSearch(event.target.value)} />
            </label>
            <button type="submit">Cari</button>
            <button type="button" onClick={() => setRefresh(value => value + 1)} disabled={loading} aria-label="Muat ulang data"><RefreshCw size={18} /></button>
          </form>
          {loading ? <p className="asset-receipt-message" role="status">Memuat data tanda terima asset...</p>
            : error ? <div className="asset-receipt-message" role="alert"><p>{error}</p><button onClick={() => setRefresh(value => value + 1)}>Coba lagi</button></div>
            : rows.length === 0 ? <p className="asset-receipt-message">{query ? 'Tidak ada asset Anda yang sesuai pencarian.' : 'Belum ada tanda terima asset yang sesuai dengan identitas karyawan Anda.'}</p>
            : <>
              <div className="asset-receipt-list-heading"><h2>Asset Anda</h2><span>{meta.total} asset{query ? ' ditemukan' : ' terdaftar'}</span></div>
              <div className="asset-receipt-table-wrap" tabIndex={0} role="region" aria-label="Daftar tanda terima asset">
                <table className="asset-receipt-table" role="table">
                  <thead><tr><th>No.</th><th>Asset</th><th>Merk / Nomor Seri</th><th>Kategori</th><th>Pemegang</th><th>Lokasi</th><th>Kondisi</th><th>Status</th><th>Tanggal Terima</th><th>Keterangan</th><th>Aksi</th></tr></thead>
                  <tbody>{rows.map((row, index) => <tr key={row.id} role="row" className={expandedAssets.has(row.id) ? 'is-expanded' : 'is-collapsed'}>
                    <td data-label="No." className="asset-receipt-number" role="cell">{(meta.current_page - 1) * meta.per_page + index + 1}</td>
                    <td data-label="Asset" className="asset-receipt-name" role="cell">
                      <strong>{row.nama_asset}</strong><small>{row.kode_asset}</small>
                      <button type="button" className="asset-receipt-detail-toggle" aria-expanded={expandedAssets.has(row.id)} aria-label={`${expandedAssets.has(row.id) ? 'Sembunyikan' : 'Tampilkan'} detail ${row.nama_asset}`} onClick={() => toggleAssetDetails(row.id)}>
                        {expandedAssets.has(row.id) ? 'Sembunyikan Detail' : 'Tampilkan Detail'}
                        {expandedAssets.has(row.id) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </td>
                    <td data-label="Merk / Nomor Seri" role="cell">{row.nama_merk || '—'}<small>{row.nomor_seri || '—'}</small></td>
                    <td data-label="Kategori" role="cell">{row.kategori || '—'}</td>
                    <td data-label="Pemegang" className="asset-receipt-holder" role="cell">{row.nama_pemegang || '—'}<small>NIK: {row.nik_pemegang || '—'}</small><small>{row.departemen_pemegang || '—'}</small></td>
                    <td data-label="Lokasi" role="cell">{row.lokasi || '—'}</td><td data-label="Kondisi" role="cell">{row.kondisi || '—'}</td><td data-label="Status" role="cell"><span className="asset-receipt-status">{row.status || '—'}</span></td>
                    <td data-label="Tanggal Terima" role="cell">{formatDate(row.tanggal_tanda_terima)}</td><td data-label="Keterangan" className="asset-receipt-notes" role="cell">{row.keterangan || '—'}</td>
                    <td data-label="Aksi" className="asset-receipt-actions-cell" role="cell"><div className="asset-receipt-row-actions">
                      <span className={`asset-receipt-photo-status ${row.has_foto ? 'is-complete' : 'is-pending'}`}>{row.has_foto ? <CheckCircle2 size={16} /> : <Camera size={16} />}{row.has_foto ? 'Foto Bukti Serah Terima' : 'Belum ada foto'}</span>
                      {!row.has_foto && <button className="asset-receipt-primary" onClick={() => setCameraAsset(row)} aria-label={`Ambil foto ${row.nama_asset}`}><Camera size={16} /> Ambil Foto Asset</button>}
                      {!!row.has_foto && <button onClick={() => setViewer({ id: row.id })}><Image size={16} /> Lihat Foto</button>}
                    </div></td>
                  </tr>)}</tbody>
                </table>
              </div>
              <div className="asset-receipt-pagination">
                <span>{meta.total} data · Halaman {meta.current_page} dari {meta.last_page}</span>
                <div><button disabled={meta.current_page <= 1} onClick={() => setPage(meta.current_page - 1)}>Sebelumnya</button><button disabled={meta.current_page >= meta.last_page} onClick={() => setPage(meta.current_page + 1)}>Berikutnya</button></div>
              </div>
            </>}
          </>}
        </>}
      </div>
      {cameraAsset && <AssetPhotoCamera assetName={`${cameraAsset.kode_asset} — ${cameraAsset.nama_asset}`} onClose={() => setCameraAsset(null)} onSave={savePhoto} />}
      {viewer && <AssetReceiptViewer {...viewer} token={token} onClose={() => setViewer(null)} />}
    </section>
  )
}
