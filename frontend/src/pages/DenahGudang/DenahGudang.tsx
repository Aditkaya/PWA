import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowLeft, RefreshCw, Warehouse } from 'lucide-react'
import './DenahGudang.css'
import LayoutEditor from './LayoutEditor'

type Gudang = { id: number; nama_gudang: string; lokasi: string | null; status: string }
type Block = { code: string; bays: number; rows: number; tiers: number; disabled: { bay: number; row: number }[] }
type Position = { id: number; key: string; source: string; container_number: string; block: string; bay: number; row: number; tier: number; span: number; stale: boolean }
type Container = { key: string; number: string; source: string; size: string | null }
type Plan = { gudang: Gudang; layout: { blocks: Block[] } | null; version: number; can_edit: boolean; positions: Position[]; containers: Container[] }
const numbers = (count: number) => Array.from({ length: count }, (_, i) => i + 1)
const pad = (value: number) => String(value).padStart(2, '0')
const locationCode = (p: Position) => `${p.block}-S${pad(p.bay)}-B${pad(p.row)}-T${pad(p.tier)}`

async function request<T>(query: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || '/api'}/denah-gudang${query}`, { signal, headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } })
  const result = await response.json()
  if (!response.ok) throw new Error(result.message || 'Denah gagal dimuat.')
  return result.data
}

export default function DenahGudang() {
  const [params, setParams] = useSearchParams()
  const gudangId = params.get('gudang_id') || ''
  const [gudangs, setGudangs] = useState<Gudang[]>([])
  const [plan, setPlan] = useState<Plan | null>(null)
  const [area, setArea] = useState('')
  const [tier, setTier] = useState(1)
  const [selected, setSelected] = useState<Position | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [editing, setEditing] = useState(false)
  const [notice, setNotice] = useState('')
  const [panel, setPanel] = useState<'map' | 'list'>('map')

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    setPlan(null)
    setEditing(false)
    setNotice('')
    setPanel('map')
    setSelected(null)
    setSearch('')
    setFilter('all')
    async function load() {
      try {
        if (gudangId) {
          const data = await request<Plan>(`?gudang_id=${encodeURIComponent(gudangId)}`, controller.signal)
          if (controller.signal.aborted) return
          setPlan(data)
          setArea(data.layout?.blocks[0]?.code || '')
          setTier(1)
        } else {
          const data = await request<Gudang[]>('', controller.signal)
          if (!controller.signal.aborted) setGudangs(data)
        }
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Gagal memuat denah.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [gudangId, reload])

  const block = plan?.layout?.blocks.find(b => b.code === area)
  const positions = plan?.positions || []
  const positionByKey = new Map(positions.map(p => [p.key, p]))
  const containers = [...(plan?.containers || [])]
  for (const p of positions) {
    if (!containers.some(c => c.key === p.key)) containers.push({ key: p.key, number: p.container_number, source: p.source, size: `${p.span * 20}` })
  }
  const found = containers.filter(c => {
    const p = positionByKey.get(c.key)
    return (filter === 'all' || (filter === 'assigned' ? !!p : !p)) &&
      `${c.number} ${p ? locationCode(p) : ''}`.toLowerCase().includes(search.trim().toLowerCase())
  })
  function choose(p: Position) { setSelected(p); setArea(p.block); setTier(p.tier); setPanel('map') }

  return <section className="dg-page">
    <header className="dg-heading"><Warehouse size={28} /><div><h2>Denah Gudang</h2><p>{plan ? plan.gudang.nama_gudang : 'Pilih gudang untuk melihat posisi kontainer.'}</p></div>
      <button type="button" onClick={() => setReload(n => n + 1)} disabled={loading || editing} aria-label="Muat ulang denah"><RefreshCw size={18} /></button>
    </header>
    {gudangId && <button className="dg-back" disabled={editing} onClick={() => setParams({})}><ArrowLeft size={18} /> Ganti Gudang</button>}
    {notice && <p role="status">{notice}</p>}
    {editing && plan && <LayoutEditor gudangId={plan.gudang.id} version={plan.version} layout={plan.layout} positions={plan.positions} onCancel={() => setEditing(false)} onSaved={data => {
      setPlan({ ...plan, ...data }); setEditing(false); setArea(data.layout.blocks[0].code); setTier(1); setSelected(null); setNotice('Layout gudang berhasil disimpan dan tersinkron dengan AYPSIS.')
    }} />}
    {loading && <p role="status">Memuat denah gudang...</p>}
    {error && <div className="dg-error" role="alert">{error} <button onClick={() => setReload(n => n + 1)}>Coba lagi</button></div>}
    {!loading && !error && !gudangId && <div className="dg-warehouses">
      {!gudangs.length && <p>Belum ada gudang di AYPSIS.</p>}
      {gudangs.map(g => <button className="dg-card dg-warehouse" key={g.id} onClick={() => setParams({ gudang_id: String(g.id) })}>
        <Warehouse size={24} /><strong>{g.nama_gudang}</strong><span>{g.lokasi || 'Lokasi belum diisi'}</span><small>{g.status === 'aktif' ? 'Aktif' : 'Nonaktif'}</small><span className="dg-link">Buka Denah →</span>
      </button>)}
    </div>}
    {!loading && !error && plan && !editing && <>
      <p>{plan.gudang.lokasi} · {plan.gudang.status === 'aktif' ? 'Aktif' : 'Nonaktif'}</p>
      {plan.can_edit ? <button className="dg-back dg-edit-button" onClick={() => { setEditing(true); setNotice('') }}>Atur Layout</button> : <details className="dg-help dg-guide"><summary>Akses pengaturan layout</summary><p>Login ulang setelah pembaruan dan gunakan akun dengan izin lihat serta edit Master Gudang di AYPSIS.</p></details>}
      <div className="dg-stats"><span><strong>{plan.containers.length}</strong> kontainer</span><span><strong>{positions.length}</strong> posisi tersimpan</span><span><strong>{plan.containers.filter(c => !positionByKey.has(c.key)).length}</strong> belum ditempatkan</span></div>
      <div className="dg-segments" aria-label="Tampilan gudang"><button aria-pressed={panel === 'map'} onClick={() => setPanel('map')}>Denah</button><button aria-pressed={panel === 'list'} onClick={() => setPanel('list')}>Cari Kontainer</button></div>
      <div className={panel !== 'map' ? 'dg-mobile-hidden' : ''}>
      {!block ? <div className="dg-card">Layout gudang belum dikonfigurasi. {plan.can_edit ? 'Gunakan tombol Atur Layout untuk membuat area gudang.' : 'Hubungi pengguna dengan izin edit Master Gudang untuk mengatur layout.'}</div> : <div className="dg-card">
        <div className="dg-controls dg-map-controls"><label>Area<select value={area} onChange={e => { setArea(e.target.value); setTier(1); setSelected(null) }}>{plan.layout?.blocks.map(b => <option key={b.code} value={b.code}>{b.code}</option>)}</select></label>
          <label>Tingkat<select value={tier} onChange={e => { setTier(Number(e.target.value)); setSelected(null) }}>{numbers(block.tiers).map(t => <option key={t} value={t}>{t}{t === 1 ? ' (Dasar)' : ''}</option>)}</select></label></div>
        <div className="dg-legend"><span>□ Kosong</span><span className="dg-stock-label">■ Milik sendiri</span><span className="dg-sewa-label">■ Sewa</span><span>▧ Jalan / nonaktif</span><span className="dg-stale-label">■ Perlu diperiksa</span></div>
        <div className="dg-map" tabIndex={0} role="region" aria-label={`Denah area ${area}, tingkat ${tier}; geser untuk melihat seluruh denah`}>
          <table><caption>Area {area} · Tingkat {tier}</caption><thead><tr><th>Slot / Baris</th>{numbers(block.rows).map(r => <th key={r}>B{pad(r)}</th>)}</tr></thead><tbody>
            {numbers(block.bays).map(bay => <tr key={bay}><th>S{pad(bay)}</th>{numbers(block.rows).map(row => {
              const p = positions.find(p => p.block === area && p.tier === tier && p.row === row && bay >= p.bay && bay < p.bay + p.span)
              if (p && bay > p.bay) return null
              const disabled = block.disabled.some(d => d.bay === bay && d.row === row)
              return <td key={row} rowSpan={p?.span || 1}><button
                className={`dg-slot ${p ? `dg-${p.source}` : ''} ${disabled ? 'dg-blocked' : ''} ${p?.stale ? 'dg-stale' : ''} ${p && selected?.id === p.id ? 'dg-selected' : ''}`}
                disabled={!p} onClick={() => p && choose(p)} aria-label={p ? `${p.container_number}, ${locationCode(p)}` : disabled ? 'Jalan / nonaktif' : 'Kosong'}
                style={{ minHeight: p?.span === 2 ? 148 : 70 }}>
                {p ? <><strong>{p.container_number}</strong><small>{p.span * 20} ft · {p.source === 'stock' ? 'Milik sendiri' : 'Sewa'}</small>{p.stale && <small>Perlu diperiksa</small>}</> : disabled ? 'Jalan' : 'Kosong'}
              </button></td>
            })}</tr>)}
          </tbody></table>
        </div>
        <details className="dg-help dg-guide"><summary>Cara membaca denah</summary><p>Geser untuk melihat seluruh area. Ketuk kontainer untuk melihat detailnya. Slot bertambah ke bawah, baris ke kanan. Kontainer 40 kaki memakai dua slot. Perubahan posisi dilakukan melalui AYPSIS.</p></details>
        {selected && <div className="dg-detail" role="status"><strong>{selected.container_number}</strong><span>{locationCode(selected)} · {selected.span * 20} ft</span>{selected.stale && <span>Perlu diperiksa: data kontainer sudah berubah di AYPSIS.</span>}</div>}
      </div>}
      </div>
      <div className={`dg-card ${panel !== 'list' ? 'dg-mobile-hidden' : ''}`}><h3>Daftar Kontainer</h3><div className="dg-controls"><label>Cari kontainer / kode lokasi<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Nomor atau kode lokasi" /></label><label>Tampilkan<select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Semua kontainer</option><option value="assigned">Sudah ditempatkan</option><option value="unassigned">Belum ditempatkan</option></select></label></div>
        <div className="dg-list">{found.map(c => { const p = positionByKey.get(c.key); return <button key={c.key} disabled={!p} onClick={() => { if (p) { choose(p); requestAnimationFrame(() => document.querySelector('.dg-map')?.scrollIntoView({ behavior: 'smooth', block: 'center' })) } }}><strong>{c.number || 'Nomor belum diisi'}</strong><span>{c.size || 'Ukuran belum diisi'} · {c.source === 'stock' ? 'Milik sendiri' : 'Sewa'}</span><span>{p ? locationCode(p) : 'Belum ditempatkan'}{p?.stale ? ' · Perlu diperiksa' : ''}</span></button> })}</div>
        {!found.length && <p>Tidak ada kontainer yang sesuai.</p>}
      </div>
    </>}
  </section>
}
