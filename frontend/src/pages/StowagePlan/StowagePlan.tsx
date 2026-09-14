import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowLeft, Ship } from 'lucide-react'
import './StowagePlan.css'
import FitLayout from './FitLayout'

const Ship3D = lazy(() => import('./Ship3D').catch(() => ({
  default: () => <p role="alert">View 3D gagal dimuat. Muat ulang aplikasi atau gunakan Kapal 2D.</p>,
})))

type Layout = { bays: string[]; rows: string[]; tiers: string[]; disabled_slots: string[] }
type Manifest = { id: number; nomor_kontainer: string | null; size_kontainer: string | null; plan_id: number | null; bay: string | null; row: string | null; tier: string | null }
type Plan = { layout: Layout; manifests: Manifest[] }

async function request<T>(path: string, signal?: AbortSignal, body?: object): Promise<T> {
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || '/api'}/stowage-plan${path}`, {
    signal,
    ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.message || 'Permintaan gagal. Silakan coba kembali.')
  return result.data
}

export default function StowagePlan() {
  const [params, setParams] = useSearchParams()
  const activeShip = params.get('nama_kapal') || ''
  const activeVoyage = params.get('no_voyage') || ''
  const viewing = !!(activeShip && activeVoyage)
  const [ship, setShip] = useState(activeShip)
  const [voyage, setVoyage] = useState(activeVoyage)
  const [ships, setShips] = useState<string[]>([])
  const [voyages, setVoyages] = useState<string[]>([])
  const [loadingShips, setLoadingShips] = useState(false)
  const [loadingVoyages, setLoadingVoyages] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [voyageError, setVoyageError] = useState('')
  const [notice, setNotice] = useState('')
  const [retry, setRetry] = useState(0)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [tier, setTier] = useState('')
  const [bay, setBay] = useState('')
  const [row, setRow] = useState('')
  const [selected, setSelected] = useState('')
  const [mode, setMode] = useState<'deck' | 'bay' | '3d'>('deck')
  const [saving, setSaving] = useState(false)
  const [panel, setPanel] = useState<'input' | 'layout'>('input')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')
  const [viewBay, setViewBay] = useState('')
  const [viewTier, setViewTier] = useState('')
  const editorRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (viewing) return
    const controller = new AbortController()
    setLoadingShips(true)
    setError('')
    request<string[]>('/ships', controller.signal).then(setShips).catch(e => {
      if (!controller.signal.aborted) setError(e.message)
    }).finally(() => { if (!controller.signal.aborted) setLoadingShips(false) })
    return () => controller.abort()
  }, [viewing, retry])

  useEffect(() => {
    if (viewing || !ship) return
    const controller = new AbortController()
    setLoadingVoyages(true)
    setVoyageError('')
    request<string[]>(`/voyages?${new URLSearchParams({ nama_kapal: ship })}`, controller.signal).then(setVoyages).catch(e => {
      if (!controller.signal.aborted) setVoyageError(e.message)
    }).finally(() => { if (!controller.signal.aborted) setLoadingVoyages(false) })
    return () => controller.abort()
  }, [ship, viewing, retry])

  useEffect(() => {
    if (!viewing) return
    const controller = new AbortController()
    setLoading(true)
    setError('')
    setPlan(null)
    setSelected('')
    setSearch('')
    request<Plan>(`?${new URLSearchParams({ nama_kapal: activeShip, no_voyage: activeVoyage })}`, controller.signal).then(data => {
      setPlan(data)
      setViewBay(previous => data.layout.bays.includes(previous) ? previous : data.layout.bays[0] || '')
      setViewTier(previous => data.layout.tiers.includes(previous) ? previous : data.layout.tiers[0] || '')
      setTier(previous => data.layout.tiers.includes(previous) ? previous : data.layout.tiers[0] || '')
      setBay(previous => data.layout.bays.includes(previous) ? previous : data.layout.bays[0] || '')
      setRow(previous => data.layout.rows.includes(previous) ? previous : data.layout.rows[0] || '')
    }).catch(e => { if (!controller.signal.aborted) setError(e.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [viewing, activeShip, activeVoyage, retry])

  const containers = useMemo(() => Object.values((plan?.manifests || []).reduce<Record<string, Manifest>>((groups, manifest) => {
    const key = manifest.nomor_kontainer || `manifest-${manifest.id}`
    if (!groups[key] || manifest.plan_id) groups[key] = manifest
    return groups
  }, {})), [plan])
  const layout = plan?.layout
  const ready = !!(layout?.bays.length && layout.rows.length && layout.tiers.length)
  const rows = [...(layout?.rows || [])].sort((a, b) => {
    const evenA = +a % 2 === 0, evenB = +b % 2 === 0
    return evenA !== evenB ? (evenA ? -1 : 1) : evenA ? +b - +a : +a - +b
  })
  const current = containers.find(c => String(c.id) === selected)
  const matching = containers.filter(c => (filter === 'all' || !c.plan_id) &&
    (c.nomor_kontainer || `Manifest ${c.id}`).toLowerCase().includes(search.trim().toLowerCase()))

  function selectContainer(c: Manifest) {
    setSelected(String(c.id))
    if (c.plan_id) { setBay(c.bay || ''); setRow(c.row || ''); setTier(c.tier || '') }
  }

  function showEditor() {
    setPanel('input')
    requestAnimationFrame(() => editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  async function save(cancel = false) {
    if (!current || saving) return
    if (cancel && !window.confirm(`Batalkan penempatan ${current.nomor_kontainer || 'kontainer ini'}?`)) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const result = await request<{ message: string }>(cancel ? '/cancel' : '', undefined, {
        nama_kapal: activeShip, no_voyage: activeVoyage, manifest_id: current.id, bay, row, tier,
      })
      setNotice(result.message)
      setPanel('input')
      setRetry(value => value + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan posisi kontainer.')
    } finally { setSaving(false) }
  }

  function cell(cellBay: string, cellRow: string, cellTier: string) {
    const slot = cellBay + cellRow + cellTier
    const previous = layout!.bays[layout!.bays.indexOf(cellBay) - 1]
    const container = containers.find(c => c.plan_id && c.row === cellRow && c.tier === cellTier &&
      (c.bay === cellBay || (c.bay === previous && String(c.size_kontainer).includes('40'))))
    const disabled = layout!.disabled_slots.includes(slot)
    return <td key={slot}><button type="button" disabled={saving || (disabled && !container)}
      className={`sp-slot ${disabled ? 'sp-disabled' : ''} ${container ? String(container.size_kontainer).includes('40') ? 'sp-forty' : 'sp-filled' : ''} ${bay === cellBay && row === cellRow && tier === cellTier ? 'sp-selected' : ''}`}
      title={`${slot}${disabled ? ' · Slot nonaktif' : ''}${container ? ` · ${container.nomor_kontainer}` : ''}`}
      onClick={() => {
        setBay(container?.bay || cellBay); setRow(cellRow); setTier(cellTier)
        if (container) setSelected(String(container.id))
        showEditor()
      }}>
      <small>{slot}</small>
      <span>{container ? container.nomor_kontainer || `Manifest ${container.id}` : disabled ? 'Nonaktif' : 'Kosong'}</span>
      {container && <small>{container.size_kontainer || '-'} ft</small>}
    </button></td>
  }

  return <section className="stowage-page">
    <div className="sp-heading"><Ship size={28} /><div><h2>Stowage Plan</h2><p>{viewing ? `${activeShip} · Voyage ${activeVoyage}` : 'Pilih kapal dan voyage untuk membuka tata letak kontainer.'}</p></div></div>
    {(error || voyageError) && <div className="sp-error" role="alert">{error || voyageError} <button type="button" disabled={saving} onClick={() => setRetry(v => v + 1)}>Coba lagi</button></div>}
    {notice && <p role="status" className="sp-notice">{notice}</p>}
    {!viewing ? <form className="sp-card sp-form" onSubmit={e => {
      e.preventDefault()
      if (ships.includes(ship) && voyages.includes(voyage)) {
        setVoyageError(''); setNotice(''); setParams({ nama_kapal: ship, no_voyage: voyage })
      }
    }}>
      <label htmlFor="sp-ship">Kapal</label>
      <select id="sp-ship" required value={ship} disabled={loadingShips} onChange={e => {
        setShip(e.target.value); setVoyage(''); setVoyages([]); setVoyageError(''); setLoadingVoyages(!!e.target.value)
      }}><option value="">{loadingShips ? 'Memuat kapal...' : '-- Pilih kapal --'}</option>{ships.map(s => <option key={s}>{s}</option>)}</select>
      {!loadingShips && !ships.length && !error && <p>Belum ada kapal pada manifest.</p>}
      <label htmlFor="sp-voyage">Voyage</label>
      <select id="sp-voyage" required value={voyage} disabled={!ship || loadingVoyages} onChange={e => setVoyage(e.target.value)}>
        <option value="">{loadingVoyages ? 'Memuat voyage...' : '-- Pilih voyage --'}</option>{voyages.map(v => <option key={v}>{v}</option>)}
      </select>
      <p>{!ship ? 'Pilih kapal terlebih dahulu.' : !loadingVoyages && !voyages.length && !voyageError ? 'Belum ada voyage untuk kapal ini.' : 'Layout mengikuti pengaturan Master Kapal di AYPSIS.'}</p>
      <button className="sp-primary" disabled={!ship || !voyage || loadingShips || loadingVoyages || !!error || !!voyageError}>Lanjutkan</button>
    </form> : <>
      <button className="sp-back" disabled={saving} onClick={() => { setShip(activeShip); setVoyage(activeVoyage); setNotice(''); setParams({}) }}><ArrowLeft size={16} /> Ganti kapal / voyage</button>
      {loading && <p role="status">Memuat stowage plan...</p>}
      {plan && <>
        <p>{containers.length} kontainer · {containers.filter(c => c.plan_id).length} ditempatkan · {containers.filter(c => !c.plan_id).length} belum ditempatkan</p>
        {!ready && <div className="sp-card">Layout kapal belum lengkap. Isi Bay, Row, dan Tier melalui Master Kapal → Edit di AYPSIS.</div>}
        <div className="sp-panel-switch" aria-label="Bagian stowage plan">
          <button type="button" aria-pressed={panel === 'input'} onClick={() => setPanel('input')}>Input kontainer</button>
          <button type="button" aria-pressed={panel === 'layout'} onClick={() => { setViewBay(bay); setViewTier(tier); setPanel('layout') }}>Layout kapal</button>
        </div>
        {ready && <div className={`sp-card sp-layout-panel ${panel !== 'layout' ? 'sp-mobile-hidden' : ''}`}>
          <h3>Pilih posisi di kapal</h3>
          {current && <p>Kontainer dipilih: <strong>{current.nomor_kontainer || `Manifest ${current.id}`}</strong>. Ketuk slot kosong untuk menentukan tujuan.</p>}
          <div className="sp-toolbar">
            <label>Tampilan<select value={mode} onChange={e => setMode(e.target.value as 'deck' | 'bay' | '3d')}><option value="deck">Kapal 2D (per tier)</option><option value="bay">Penampang (per bay)</option><option value="3d">Kapal 3D</option></select></label>
            {mode === 'deck' ? <label>Tier<select value={viewTier} onChange={e => setViewTier(e.target.value)}>{layout!.tiers.map(t => <option key={t}>{t}</option>)}</select></label>
              : mode === 'bay' ? <label>Bay<select value={viewBay} onChange={e => setViewBay(e.target.value)}>{layout!.bays.map(b => <option key={b}>{b}</option>)}</select></label> : null}
          </div>
          <p className="sp-legend"><span>🟧 20 ft / lainnya</span><span>🟦 40 ft (2 bay)</span><span>Abu-abu: slot nonaktif</span></p>
          {mode === '3d' ? <Suspense fallback={<p role="status">Memuat kapal 3D...</p>}>
            <Ship3D layout={layout!} containers={containers} onSelect={c => { if (!saving) { selectContainer(c); showEditor() } }} />
          </Suspense> : <FitLayout ocean={mode === 'deck'}>
            <div className={mode === 'deck' ? 'sp-ship-deck' : 'sp-cross-section'}>
            {mode === 'deck' && <>
              <svg className="sp-hull-outline" viewBox="0 0 600 1000" preserveAspectRatio="none" aria-hidden="true"><path d="M300 10 Q565 60 584 165 L584 945 Q584 983 546 983 L54 983 Q16 983 16 945 L16 165 Q35 60 300 10 Z" /></svg>
              <div className="sp-bow-label">▲ HALUAN</div>
            </>}
            <table><caption>{mode === 'deck' ? `Deck plan · Tier ${viewTier} · Haluan di atas` : `Penampang · Bay ${viewBay}`}</caption><thead><tr><th>{mode === 'deck' ? 'Bay / Row' : 'Tier / Row'}</th>{rows.map(r => <th key={r}>{r}</th>)}</tr></thead>
              <tbody>{mode === 'deck' ? layout!.bays.map(b => <tr key={b}><th>{b}</th>{rows.map(r => cell(b, r, viewTier))}</tr>)
                : [...layout!.tiers].reverse().map(t => <tr key={t}><th>{t}</th>{rows.map(r => cell(viewBay, r, t))}</tr>)}</tbody>
            </table>
            {mode === 'deck' && <div className="sp-stern"><div className="sp-bridge">▰ ▰ ▰ ▰ ▰<br /><strong>ANJUNGAN</strong></div><span>BURITAN</span></div>}
            </div>
          </FitLayout>}
          {mode !== '3d' && <div className="sp-layout-navigation">
            <button type="button" disabled={saving || (mode === 'deck' ? layout!.tiers.indexOf(viewTier) : layout!.bays.indexOf(viewBay)) <= 0} onClick={() => {
              if (mode === 'deck') setViewTier(layout!.tiers[layout!.tiers.indexOf(viewTier) - 1])
              else setViewBay(layout!.bays[layout!.bays.indexOf(viewBay) - 1])
            }}>← {mode === 'deck' ? 'Tier' : 'Bay'} sebelumnya</button>
            <button type="button" disabled={saving || (mode === 'deck' ? layout!.tiers.indexOf(viewTier) >= layout!.tiers.length - 1 : layout!.bays.indexOf(viewBay) >= layout!.bays.length - 1)} onClick={() => {
              if (mode === 'deck') setViewTier(layout!.tiers[layout!.tiers.indexOf(viewTier) + 1])
              else setViewBay(layout!.bays[layout!.bays.indexOf(viewBay) + 1])
            }}>{mode === 'deck' ? 'Tier' : 'Bay'} berikutnya →</button>
          </div>}
          {mode !== '3d' && <p>Seluruh layout pas di layar. Ketuk slot untuk memilih posisi. Untuk slot yang kecil, gunakan pilihan Bay, Row, dan Tier di tab Input kontainer.</p>}
        </div>}
        <form ref={editorRef} className={`sp-card sp-form sp-editor ${panel !== 'input' && ready ? 'sp-mobile-hidden' : ''}`} onSubmit={e => { e.preventDefault(); void save() }}>
          {notice && <p className="sp-notice" role="status">{notice} Pilih kontainer berikutnya.</p>}
          {error && <div className="sp-error" role="alert">{error}</div>}
          <h3>1. Pilih kontainer</h3>
          {current ? <div className="sp-current">
            <div><strong>{current.nomor_kontainer || `Manifest ${current.id}`}</strong><p>{current.size_kontainer || '-'} ft · {current.plan_id ? 'Sudah ditempatkan' : 'Belum ditempatkan'}</p></div>
            <button type="button" disabled={saving} onClick={() => setSelected('')}>Ganti</button>
          </div> : <>
            <label htmlFor="sp-search">Cari nomor kontainer</label>
            <input id="sp-search" type="search" placeholder="Ketik nomor atau 4 digit terakhir" autoComplete="off" value={search} disabled={saving} onChange={e => setSearch(e.target.value)} />
            <div className="sp-filters">
              <button type="button" aria-pressed={filter === 'pending'} onClick={() => setFilter('pending')}>Belum ditempatkan ({containers.filter(c => !c.plan_id).length})</button>
              <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>Semua</button>
            </div>
            <div className="sp-container-list" aria-label="Pilih kontainer">
              {matching.map(c => <button type="button" key={c.id} disabled={saving} onClick={() => selectContainer(c)}>
                <strong>{c.nomor_kontainer || `Manifest ${c.id}`}</strong>
                <span>{c.size_kontainer || '-'} ft · {c.plan_id ? `Posisi ${c.bay}/${c.row}/${c.tier}` : 'Belum ditempatkan'}</span>
              </button>)}
              {!matching.length && <p>{search ? 'Kontainer tidak ditemukan.' : 'Tidak ada kontainer pada filter ini. Pilih Semua untuk melihat posisi yang sudah tersimpan.'}</p>}
            </div>
          </>}
          <h3>2. Tentukan posisi</h3>
          {current?.plan_id && <p>Posisi tersimpan: Bay {current.bay}, Row {current.row}, Tier {current.tier}.</p>}
          <div className="sp-toolbar">{([
            ['Bay', bay, setBay, layout!.bays], ['Row', row, setRow, rows], ['Tier', tier, setTier, layout!.tiers],
          ] as const).map(([label, value, setter, values]) => <label key={label}>{label}<select required value={value} disabled={!ready || saving} onChange={e => setter(e.target.value)}><option value="">Pilih</option>{values.map(v => <option key={v}>{v}</option>)}</select></label>)}</div>
          {ready && <button type="button" className="sp-map-button" disabled={saving} onClick={() => {
            setViewBay(bay); setViewTier(tier); setPanel('layout')
            requestAnimationFrame(() => document.querySelector('.sp-layout-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
          }}>Pilih slot dari layout kapal</button>}
          <div className="sp-save-bar">
            <p>{current ? `${current.nomor_kontainer || `Manifest ${current.id}`} → Bay ${bay || '-'} / Row ${row || '-'} / Tier ${tier || '-'}` : 'Pilih kontainer untuk mulai mengisi posisi.'}</p>
            <button className="sp-primary" disabled={!ready || !current || !bay || !row || !tier || saving}>{saving ? 'Memproses...' : current?.plan_id ? 'Simpan perubahan posisi' : 'Simpan & lanjut kontainer berikutnya'}</button>
          </div>
          {current?.plan_id && <button type="button" className="sp-danger" disabled={saving} onClick={() => void save(true)}>Batalkan penempatan</button>}
        </form>
      </>}
    </>}
  </section>
}
