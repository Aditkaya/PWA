import { useEffect, useRef, useState } from 'react'
import { Download, Plus, RefreshCw, RotateCcw, X } from 'lucide-react'

interface AssetOption {
  id: number
  kode_asset: string
  nama_asset: string
  nama_merk: string | null
  nomor_seri: string | null
  nama_pemegang: string
  nik_pemegang: string
  departemen_pemegang: string | null
}
interface ItemInput { kondisi: string; kelengkapan: string; keterangan: string }
interface ReturnFormData {
  tanggal_pengembalian: string
  alasan: string
  alasan_lainnya: string
  catatan: string
  nama_pic: string
  nama_hrd: string
  items: (ItemInput & AssetOption)[]
  nama_karyawan: string
  nik: string
  departemen: string
}
interface ReturnRecord {
  id: number
  nomor_dokumen: string
  tanggal_pengembalian: string
  alasan: string
  status: 'menunggu_admin' | 'dikembalikan'
  items: { asset_id: number; tanda_terima_asset_id: number; released_at: string | null }[]
  form: ReturnFormData
}
const baseUrl = '/api/tanda-terima-asset/pengembalian'
const message = (reason: unknown) => reason instanceof Error ? reason.message : 'Gagal terhubung ke server.'
const headers = (token: string | null) => ({ Authorization: `Bearer ${token || ''}` })
async function jsonResponse(response: Response) {
  const body = await response.json()
  if (!response.ok) throw new Error(body.message || 'Proses pengembalian gagal.')
  return body
}
function today() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
function displayDate(date: string) {
  return new Date(date + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

function ReturnForm({ token, onClose, onSaved }: { token: string | null; onClose: () => void; onSaved: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [assets, setAssets] = useState<AssetOption[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<Record<number, ItemInput>>({})
  const [form, setForm] = useState({ tanggal_pengembalian: today(), alasan: '', alasan_lainnya: '', catatan: '', nama_pic: '', nama_hrd: '' })
  useEffect(() => { dialog.current?.showModal() }, [])
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setLoadError('')
    fetch(`${baseUrl}/options`, { signal: controller.signal, cache: 'no-store', headers: headers(token) })
      .then(jsonResponse)
      .then(body => setAssets(body.data))
      .catch(reason => { if (!controller.signal.aborted) setLoadError(message(reason)) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [token, retry])
  const setItem = (id: number, key: keyof ItemInput, value: string) => setSelected(previous => ({ ...previous, [id]: { ...previous[id], [key]: value } }))
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (busy) return
    if (!Object.keys(selected).length) { setError('Pilih minimal satu asset.'); return }
    setBusy(true)
    setError('')
    try {
      await fetch(baseUrl, {
        method: 'POST', headers: { ...headers(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, items: Object.entries(selected).map(([id, item]) => ({ ...item, id: Number(id) })) }),
      }).then(jsonResponse)
      onSaved()
    } catch (reason) { setError(message(reason)) }
    finally { setBusy(false) }
  }
  return <dialog ref={dialog} className="asset-receipt-modal asset-return-modal" aria-labelledby="asset-return-title" onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
    <div className="asset-receipt-modal-header"><h2 id="asset-return-title">Ajukan Pengembalian Asset</h2><button disabled={busy} onClick={onClose} aria-label="Tutup formulir"><X size={20} /></button></div>
    <p>Isi formulir, unduh dokumen Word, lalu serahkan asset kepada PIC untuk pemeriksaan dan tanda tangan. Pengembalian selesai setelah admin melepas asset dari nama Anda.</p>
    {loading ? <p role="status">Memuat pilihan asset...</p> : loadError ? <div role="alert"><p>{loadError}</p><button onClick={() => setRetry(value => value + 1)}>Coba lagi</button></div>
      : !assets.length ? <p>Tidak ada asset yang dapat diajukan. Asset yang masih menunggu pelepasan admin tidak dapat diajukan kembali.</p>
        : <form onSubmit={submit} className="asset-return-form">
          <fieldset disabled={busy}>
            <legend>Data pengembalian</legend>
            <p><strong>{assets[0].nama_pemegang}</strong> · NIK {assets[0].nik_pemegang}<br />{assets[0].departemen_pemegang || 'Departemen belum diisi'}</p>
            <div className="asset-return-fields">
              <label>Tanggal pengembalian<input type="date" required value={form.tanggal_pengembalian} onChange={e => setForm({ ...form, tanggal_pengembalian: e.target.value })} /></label>
              <label>Alasan pengembalian<select required value={form.alasan} onChange={e => setForm({ ...form, alasan: e.target.value })}><option value="">Pilih alasan</option>{['Resign', 'PHK', 'Habis Kontrak', 'Mutasi', 'Penggantian', 'Lainnya'].map(value => <option key={value}>{value}</option>)}</select></label>
              {form.alasan === 'Lainnya' && <label className="asset-return-full">Alasan lainnya<input required maxLength={200} value={form.alasan_lainnya} onChange={e => setForm({ ...form, alasan_lainnya: e.target.value })} /></label>}
            </div>
          </fieldset>
          <fieldset disabled={busy}>
            <legend>Asset yang dikembalikan ({Object.keys(selected).length}/6)</legend>
            <p>Pilih maksimal enam asset per formulir sesuai template.</p>
            <div className="asset-return-choices">{assets.map(asset => <div className={`asset-return-choice ${selected[asset.id] ? 'is-selected' : ''}`} key={asset.id}>
              <label className="asset-return-check"><input type="checkbox" checked={!!selected[asset.id]} disabled={!selected[asset.id] && Object.keys(selected).length >= 6} onChange={event => {
                if (event.target.checked) setSelected(previous => ({ ...previous, [asset.id]: { kondisi: '', kelengkapan: '', keterangan: '' } }))
                else setSelected(previous => { const next = { ...previous }; delete next[asset.id]; return next })
              }} /><span><strong>{asset.nama_asset}</strong><small>{asset.kode_asset} · {asset.nama_merk || 'Merk —'} · {asset.nomor_seri || 'Serial —'}</small></span></label>
              {selected[asset.id] && <div className="asset-return-fields">
                <label>Kondisi<select required value={selected[asset.id].kondisi} onChange={e => setItem(asset.id, 'kondisi', e.target.value)}><option value="">Pilih kondisi</option><option>Baik</option><option>Rusak</option></select></label>
                <label>Kelengkapan<select required value={selected[asset.id].kelengkapan} onChange={e => setItem(asset.id, 'kelengkapan', e.target.value)}><option value="">Pilih kelengkapan</option><option>Lengkap</option><option>Tidak Lengkap</option></select></label>
                <label className="asset-return-full">Keterangan asset (opsional)<input maxLength={200} value={selected[asset.id].keterangan} onChange={e => setItem(asset.id, 'keterangan', e.target.value)} placeholder="Contoh: charger disertakan, layar tergores" /></label>
              </div>}
            </div>)}</div>
          </fieldset>
          <fieldset disabled={busy}>
            <legend>Pemeriksaan dan penerima</legend>
            <label>Catatan pemeriksaan / kerusakan / kekurangan (opsional)<textarea rows={3} maxLength={600} value={form.catatan} onChange={e => setForm({ ...form, catatan: e.target.value })} /></label>
            <div className="asset-return-fields">
              <label>Nama penerima / PIC asset (opsional)<input maxLength={100} value={form.nama_pic} onChange={e => setForm({ ...form, nama_pic: e.target.value })} /></label>
              <label>Nama HRD / atasan (opsional)<input maxLength={100} value={form.nama_hrd} onChange={e => setForm({ ...form, nama_hrd: e.target.value })} /></label>
            </div>
            <p>Kolom tanda tangan pada dokumen diisi setelah pemeriksaan bersama pihak perusahaan.</p>
          </fieldset>
          {error && <p role="alert" className="asset-receipt-error">{error}</p>}
          <div className="asset-receipt-modal-actions"><button type="button" disabled={busy} onClick={onClose}>Batal</button><button type="submit" disabled={busy || !Object.keys(selected).length}>{busy ? 'Menyimpan...' : 'Simpan Pengajuan'}</button></div>
        </form>}
  </dialog>
}

export default function AssetReturns({ token }: { token: string | null }) {
  const [records, setRecords] = useState<ReturnRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [open, setOpen] = useState(false)
  const [downloading, setDownloading] = useState<number | null>(null)
  useEffect(() => {
    const onFocus = () => { setNotice(''); setRefresh(value => value + 1) }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    fetch(baseUrl, { signal: controller.signal, cache: 'no-store', headers: headers(token) })
      .then(jsonResponse).then(body => setRecords(body.data))
      .catch(reason => { if (!controller.signal.aborted) setError(message(reason)) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [token, refresh])
  const download = async (record: ReturnRecord) => {
    setDownloading(record.id)
    setError('')
    try {
      const response = await fetch(`${baseUrl}/${record.id}/dokumen`, { cache: 'no-store', headers: headers(token) })
      if (!response.ok) { await jsonResponse(response); return }
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = `${record.nomor_dokumen}.docx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (reason) { setError(message(reason)) }
    finally { setDownloading(null) }
  }
  return <div className="asset-returns">
    <div className="asset-receipt-guide" aria-label="Alur pengembalian asset">
      <span><span className="asset-receipt-step">1</span> Ajukan pengembalian</span>
      <span><span className="asset-receipt-step">2</span> Unduh formulir dan serahkan asset ke PIC</span>
      <span><span className="asset-receipt-step">3</span> Admin melepas asset</span>
    </div>
    <p className="asset-return-intro">Pengajuan belum berarti asset sudah dikembalikan. Status selesai akan mengikuti pelepasan asset oleh admin di Master Asset.</p>
    <div className="asset-return-toolbar"><button className="asset-return-primary" onClick={() => { setNotice(''); setOpen(true) }}><Plus size={18} /> Ajukan Pengembalian</button><button disabled={loading} onClick={() => { setNotice(''); setRefresh(value => value + 1) }} aria-label="Muat ulang pengembalian"><RefreshCw size={18} /></button></div>
    {notice && <p role="status" className="asset-return-notice">{notice}</p>}
    {error && <div role="alert" className="asset-return-error"><p>{error}</p><button onClick={() => setRefresh(value => value + 1)}>Coba lagi</button></div>}
    {loading ? <p role="status" className="asset-receipt-message">Memuat riwayat pengembalian...</p>
      : !error && records.length === 0 ? <p className="asset-receipt-message">Belum ada pengajuan pengembalian asset.</p>
        : <div className="asset-return-history">{records.map(record => {
          const released = record.items.filter(item => item.released_at).length
          return <article className="asset-return-record" key={record.id}>
            <div className="asset-return-record-heading"><h2><RotateCcw size={18} /> {record.nomor_dokumen}</h2><span className={`asset-return-badge ${record.status === 'dikembalikan' ? 'is-complete' : ''}`}>{record.status === 'dikembalikan' ? 'Sudah Dikembalikan' : 'Menunggu Pelepasan Admin'}</span></div>
            <p>{displayDate(record.tanggal_pengembalian)} · {record.alasan}{record.form.alasan_lainnya ? ` — ${record.form.alasan_lainnya}` : ''}</p>
            <ul className="asset-return-item-list">{record.form.items.map((item, index) => <li key={item.id}><strong>{item.nama_asset}</strong><span>{item.kode_asset} · {item.kondisi} · {item.kelengkapan}</span><small>{record.items[index]?.released_at ? 'Sudah dilepas admin' : 'Menunggu pelepasan admin'}</small></li>)}</ul>
            {record.status !== 'dikembalikan' && released > 0 && <p>{released} dari {record.items.length} asset sudah dilepas admin.</p>}
            {record.form.catatan && <p className="asset-return-notes">Catatan: {record.form.catatan}</p>}
            <button disabled={downloading !== null} onClick={() => download(record)}><Download size={16} /> {downloading === record.id ? 'Mengunduh...' : 'Unduh Formulir Word'}</button>
          </article>
        })}</div>}
    {open && <ReturnForm token={token} onClose={() => setOpen(false)} onSaved={() => {
      setOpen(false)
      setNotice('Pengajuan tersimpan. Unduh formulir Word di bawah, lalu lanjutkan serah terima dengan PIC. Status menunggu pelepasan admin.')
      setRefresh(value => value + 1)
    }} />}
  </div>
}
