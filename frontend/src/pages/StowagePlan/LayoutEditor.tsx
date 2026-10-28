import { useEffect, useState } from 'react'

type Layout = { bays: string[]; rows: string[]; tiers: string[]; disabled_slots: string[] }
type Manifest = { id: number; nomor_kontainer: string | null; size_kontainer: string | null; plan_id: number | null; bay: string | null; row: string | null; tier: string | null }
type Axis = 'bays' | 'rows' | 'tiers'

export default function LayoutEditor({ layout, manifests, saving, onSave }: {
  layout: Layout
  manifests: Manifest[]
  saving: boolean
  onSave: (layout: Layout) => Promise<void>
}) {
  const [draft, setDraft] = useState<Layout>(layout)
  const [inputs, setInputs] = useState<Record<Axis, string>>({ bays: '', rows: '', tiers: '' })
  const [validation, setValidation] = useState('')
  const [previewTier, setPreviewTier] = useState(layout.tiers[0] || '')
  useEffect(() => { setDraft(layout); setPreviewTier(layout.tiers[0] || ''); setValidation('') }, [layout])

  const rows = [...draft.rows].sort((a, b) => {
    const evenA = +a % 2 === 0, evenB = +b % 2 === 0
    return evenA !== evenB ? (evenA ? -1 : 1) : evenA ? +b - +a : +a - +b
  })
  const tier = draft.tiers.includes(previewTier) ? previewTier : draft.tiers[0] || ''
  const occupied = new Set<string>()
  manifests.filter(m => m.plan_id && m.bay && m.row && m.tier).forEach(m => {
    const bay = m.bay!
    occupied.add(bay + m.row + m.tier)
    if (String(m.size_kontainer).includes('40')) {
      const next = draft.bays[draft.bays.indexOf(bay) + 1]
      if (next) occupied.add(next + m.row + m.tier)
    }
  })

  function add(axis: Axis) {
    const raw = inputs[axis].trim()
    if (!/^\d{1,2}$/.test(raw)) { setValidation('Masukkan angka 0 sampai 99 untuk Bay, Row, atau Tier.'); return }
    const value = raw.padStart(2, '0')
    if (draft[axis].includes(value)) { setValidation(`${axis === 'bays' ? 'Bay' : axis === 'rows' ? 'Row' : 'Tier'} ${value} sudah ada.`); return }
    setDraft(current => ({ ...current, [axis]: [...current[axis], value].sort((a, b) => +a - +b) }))
    setInputs(current => ({ ...current, [axis]: '' }))
    setValidation('')
  }

  function remove(axis: Axis, value: string) {
    setDraft(current => {
      const next = { ...current, [axis]: current[axis].filter(item => item !== value) }
      const valid = new Set(next.bays.flatMap(b => next.rows.flatMap(r => next.tiers.map(t => b + r + t))))
      return { ...next, disabled_slots: next.disabled_slots.filter(slot => valid.has(slot)) }
    })
    setValidation('')
  }

  const changed = JSON.stringify(draft) !== JSON.stringify(layout)
  return <form className="sp-card sp-layout-editor" onSubmit={e => {
    e.preventDefault()
    if (!draft.bays.length || !draft.rows.length || !draft.tiers.length) { setValidation('Tambahkan minimal satu Bay, Row, dan Tier.'); return }
    setValidation('')
    void onSave(draft)
  }}>
    <h3>Atur layout kapal</h3>
    <p>Tambahkan nomor Bay, Row, dan Tier seperti di Master Kapal AYPSIS. Ketuk slot pada pratinjau untuk mengaktifkan atau menonaktifkannya.</p>
    <div className="sp-axis-grid">{([
      ['bays', 'Bay', 'Contoh: 01'], ['rows', 'Row', 'Contoh: 00'], ['tiers', 'Tier', 'Contoh: 82'],
    ] as const).map(([axis, label, placeholder]) => <div className="sp-axis" key={axis}>
      <label htmlFor={`sp-${axis}-input`}>{label}</label>
      <div className="sp-axis-input"><input id={`sp-${axis}-input`} inputMode="numeric" pattern="[0-9]{1,2}" maxLength={2} placeholder={placeholder} value={inputs[axis]} disabled={saving} onChange={e => setInputs(current => ({ ...current, [axis]: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(axis) } }} /><button type="button" disabled={saving} onClick={() => add(axis)} aria-label={`Tambah ${label}`}>Tambah</button></div>
      <div className="sp-axis-pills">{draft[axis].map(value => <button type="button" key={value} disabled={saving} onClick={() => remove(axis, value)} aria-label={`Hapus ${label} ${value}`}>{value} ×</button>)}{!draft[axis].length && <small>Belum ada {label.toLowerCase()}.</small>}</div>
    </div>)}</div>
    {validation && <p className="sp-error" role="alert">{validation}</p>}
    {!!(draft.bays.length && rows.length && tier) && <>
      <div className="sp-toolbar"><label>Pratinjau Tier<select value={tier} onChange={e => setPreviewTier(e.target.value)}>{draft.tiers.map(t => <option key={t}>{t}</option>)}</select></label></div>
      <div className="sp-editor-preview" role="region" aria-label="Pratinjau layout kapal"><table><caption>Haluan di atas · Tier {tier}</caption><thead><tr><th>Bay / Row</th>{rows.map(row => <th key={row}>{row}</th>)}</tr></thead><tbody>{draft.bays.map(bay => <tr key={bay}><th>{bay}</th>{rows.map(row => {
        const slot = bay + row + tier
        const disabled = draft.disabled_slots.includes(slot)
        const used = occupied.has(slot)
        return <td key={slot}><button type="button" className={`sp-preview-slot ${disabled ? 'sp-preview-disabled' : ''} ${used ? 'sp-preview-used' : ''}`} disabled={saving || used} aria-pressed={disabled} title={used ? `${slot} ditempati kontainer` : `${slot} ${disabled ? 'nonaktif' : 'aktif'}`} onClick={() => setDraft(current => ({ ...current, disabled_slots: disabled ? current.disabled_slots.filter(s => s !== slot) : [...current.disabled_slots, slot] }))}>{slot}<small>{used ? 'Terisi' : disabled ? 'Nonaktif' : 'Aktif'}</small></button></td>
      })}</tr>)}</tbody></table></div>
    </>}
    <div className="sp-layout-actions"><button type="button" disabled={!changed || saving} onClick={() => { setDraft(layout); setValidation('') }}>Batalkan perubahan</button><button className="sp-primary" type="submit" disabled={!changed || saving}>{saving ? 'Menyimpan...' : 'Simpan layout kapal'}</button></div>
  </form>
}
