import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowLeft, Ship } from 'lucide-react'
import './StowagePlan.css'

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
  const [mode, setMode] = useState<'deck' | 'bay'>('deck')
  const [saving, setSaving] = useState(false)

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
    request<Plan>(`?${new URLSearchParams({ nama_kapal: activeShip, no_voyage: activeVoyage })}`, controller.signal).then(data => {
      setPlan(data)
      setTier(previous => data.layout.tiers.includes(previous) ? previous : data.layout.tiers[0] || '')
      setBay(previous => data.layout.bays.includes(previous) ? previous : data.layout.bays[0] || '')
      setRow(previous => data.layout.rows.includes(previous) ? previous : data.layout.rows[0] || '')
    }).catch(e => { if (!controller.signal.aborted) setError(e.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [viewing, activeShip, activeVoyage, retry])

  const containers = Object.values((plan?.manifests || []).reduce<Record<string, Manifest>>((groups, manifest) => {
    const key = manifest.nomor_kontainer || `manifest-${manifest.id}`
    if (!groups[key] || manifest.plan_id) groups[key] = manifest
    return groups
  }, {}))
  const layout = plan?.layout
  const ready = !!(layout?.bays.length && layout.rows.length && layout.tiers.length)
  const rows = [...(layout?.rows || [])].sort((a, b) => {
    const evenA = +a % 2 === 0, evenB = +b % 2 === 0
    return evenA !== evenB ? (evenA ? -1 : 1) : evenA ? +b - +a : +a - +b
  })
  const current = containers.find(c => String(c.id) === selected)

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
        {ready && <div className="sp-card">
          <div className="sp-toolbar">
            <label>Tampilan<select value={mode} onChange={e => setMode(e.target.value as 'deck' | 'bay')}><option value="deck">Deck plan (per tier)</option><option value="bay">Penampang (per bay)</option></select></label>
            {mode === 'deck' ? <label>Tier<select value={tier} onChange={e => setTier(e.target.value)}>{layout!.tiers.map(t => <option key={t}>{t}</option>)}</select></label>
              : <label>Bay<select value={bay} onChange={e => setBay(e.target.value)}>{layout!.bays.map(b => <option key={b}>{b}</option>)}</select></label>}
          </div>
          <p className="sp-legend"><span>🟧 20 ft / lainnya</span><span>🟦 40 ft (2 bay)</span><span>Abu-abu: slot nonaktif</span></p>
          <div className="sp-grid" tabIndex={0} role="region" aria-label="Layout kontainer, geser untuk melihat seluruh kapal">
            <table><caption>{mode === 'deck' ? `Deck plan · Tier ${tier} · Haluan di atas` : `Penampang · Bay ${bay}`}</caption><thead><tr><th>{mode === 'deck' ? 'Bay / Row' : 'Tier / Row'}</th>{rows.map(r => <th key={r}>{r}</th>)}</tr></thead>
              <tbody>{mode === 'deck' ? layout!.bays.map(b => <tr key={b}><th>{b}</th>{rows.map(r => cell(b, r, tier))}</tr>)
                : [...layout!.tiers].reverse().map(t => <tr key={t}><th>{t}</th>{rows.map(r => cell(bay, r, t))}</tr>)}</tbody>
            </table>
          </div>
          <p>Pilih kontainer terisi untuk melihat posisinya, atau pilih slot kosong untuk menentukan tujuan.</p>
        </div>}
        <form className="sp-card sp-form" onSubmit={e => { e.preventDefault(); void save() }}>
          <h3>Penempatan kontainer</h3>
          <label htmlFor="sp-container">Kontainer</label>
          <select id="sp-container" required value={selected} disabled={saving} onChange={e => {
            setSelected(e.target.value)
            const c = containers.find(item => String(item.id) === e.target.value)
            if (c?.plan_id) { setBay(c.bay || ''); setRow(c.row || ''); setTier(c.tier || '') }
          }}><option value="">-- Pilih kontainer --</option>{containers.map(c => <option key={c.id} value={c.id}>{c.nomor_kontainer || `Manifest ${c.id}`} · {c.size_kontainer || '-'} ft · {c.plan_id ? `${c.bay}/${c.row}/${c.tier}` : 'Belum ditempatkan'}</option>)}</select>
          {current?.plan_id && <p>Posisi tersimpan: Bay {current.bay}, Row {current.row}, Tier {current.tier}.</p>}
          <div className="sp-toolbar">{([
            ['Bay', bay, setBay, layout!.bays], ['Row', row, setRow, rows], ['Tier', tier, setTier, layout!.tiers],
          ] as const).map(([label, value, setter, values]) => <label key={label}>{label}<select required value={value} disabled={!ready || saving} onChange={e => setter(e.target.value)}><option value="">Pilih</option>{values.map(v => <option key={v}>{v}</option>)}</select></label>)}</div>
          <button className="sp-primary" disabled={!ready || !current || !bay || !row || !tier || saving}>{saving ? 'Memproses...' : current?.plan_id ? 'Simpan perubahan posisi' : 'Tempatkan kontainer'}</button>
          {current?.plan_id && <button type="button" className="sp-danger" disabled={saving} onClick={() => void save(true)}>Batalkan penempatan</button>}
        </form>
      </>}
    </>}
  </section>
}
