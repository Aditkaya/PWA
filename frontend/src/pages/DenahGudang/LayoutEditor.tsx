import { useEffect, useState } from 'react'

export type Block = { code: string; bays: number; rows: number; tiers: number; disabled: { bay: number; row: number }[] }
type Position = { block: string; bay: number; row: number; tier: number; span: number; container_number: string }
type Props = {
  gudangId: number; version: number; layout: { blocks: Block[] } | null; positions: Position[]
  onCancel: () => void; onSaved: (data: { layout: { blocks: Block[] }; version: number }) => void
}
const sequence = (n: number) => Array.from({ length: n }, (_, i) => i + 1)

export default function LayoutEditor({ gudangId, version, layout, positions, onCancel, onSaved }: Props) {
  const [blocks, setBlocks] = useState<Block[]>(() => structuredClone(layout?.blocks || [{ code: 'A', bays: 10, rows: 5, tiers: 3, disabled: [] }]))
  const [active, setActive] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const block = blocks[active]
  const dirty = JSON.stringify({ blocks }) !== JSON.stringify(layout)
  const total = blocks.reduce((sum, b) => sum + b.bays * b.rows, 0)

  useEffect(() => {
    function preventLoss(event: BeforeUnloadEvent) { if (dirty || saving) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', preventLoss)
    return () => window.removeEventListener('beforeunload', preventLoss)
  }, [dirty, saving])

  function cancel() {
    if (!dirty || window.confirm('Batalkan perubahan layout yang belum disimpan?')) onCancel()
  }
  function update(index: number, patch: Partial<Block>) {
    setError('')
    setBlocks(old => old.map((b, i) => i === index ? { ...b, ...patch } : b))
  }
  function resize(index: number, field: 'bays' | 'rows' | 'tiers', value: number) {
    const b = blocks[index]
    const next = { ...b, [field]: value }
    if (positions.some(p => p.block === b.code && (p.bay + p.span - 1 > next.bays || p.row > next.rows || p.tier > next.tiers))) {
      setError('Ukuran ini akan mengeluarkan kontainer dari layout. Pindahkan posisinya terlebih dahulu di AYPSIS.')
      return
    }
    update(index, { [field]: value, disabled: b.disabled.filter(d => d.bay <= next.bays && d.row <= next.rows) })
  }
  function add() {
    let n = 1
    while (blocks.some(b => b.code === `AREA${n}`)) n++
    setBlocks([...blocks, { code: `AREA${n}`, bays: 10, rows: 5, tiers: 3, disabled: [] }])
    setActive(blocks.length)
  }
  function remove(index: number) {
    if (!window.confirm(`Hapus area ${blocks[index].code} dari rancangan layout?`)) return
    setBlocks(blocks.filter((_, i) => i !== index))
    setActive(0)
  }
  function toggle(bay: number, row: number) {
    if (positions.some(p => p.block === block.code && p.row === row && bay >= p.bay && bay < p.bay + p.span)) {
      setError('Petak ini ditempati kontainer. Petak berisi kontainer pada tingkat mana pun tidak dapat dinonaktifkan.')
      return
    }
    const exists = block.disabled.some(d => d.bay === bay && d.row === row)
    update(active, { disabled: exists ? block.disabled.filter(d => d.bay !== bay || d.row !== row) : [...block.disabled, { bay, row }] })
  }
  async function save() {
    setError('')
    if (total > 2000) { setError('Maksimal 2.000 petak dasar untuk seluruh area.'); return }
    if (blocks.some(b => !/^[A-Z0-9_-]{1,12}$/.test(b.code)) || new Set(blocks.map(b => b.code)).size !== blocks.length) {
      setError('Kode area harus unik, 1–12 karakter huruf besar, angka, garis bawah atau tanda hubung.'); return
    }
    setSaving(true)
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || '/api'}/denah-gudang/layout`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
        body: JSON.stringify({ gudang_id: gudangId, version, layout: { blocks } }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Layout gagal disimpan.')
      onSaved(result.data)
    } catch (e) { setError(e instanceof Error ? e.message : 'Layout gagal disimpan.') }
    finally { setSaving(false) }
  }

  return <div className="dg-layout-editor">
    <h3>Atur Layout Gudang</h3>
    <p>Atur area, slot, baris dan tingkat. Satu slot sepanjang kontainer 20 kaki. Klik petak pratinjau untuk menandai jalan / nonaktif pada seluruh tingkat.</p>
    <fieldset disabled={saving}>
      <div className="dg-editor-areas">{blocks.map((b, i) => {
        const occupied = positions.some(p => p.block === b.code)
        return <div className="dg-card" key={i}>
          <div className="dg-controls"><label>Kode area<input value={b.code} maxLength={12} disabled={occupied} onChange={e => update(i, { code: e.target.value.toUpperCase() })} /></label>
            {(['bays', 'rows', 'tiers'] as const).map((field, j) => <label key={field}>{['Jumlah slot', 'Jumlah baris', 'Maks. tingkat'][j]}<select value={b[field]} onChange={e => resize(i, field, Number(e.target.value))}>{sequence([40, 20, 6][j]).map(n => <option key={n} value={n}>{n}</option>)}</select></label>)}
          </div>
          {occupied && <p className="dg-help">Kode area dan penghapusan dikunci karena masih ada kontainer.</p>}
          <div className="dg-editor-actions"><button onClick={() => setActive(i)} aria-pressed={active === i}>Pratinjau {b.code || 'area'}</button><button className="dg-danger" onClick={() => remove(i)} disabled={occupied || blocks.length === 1}>Hapus Area</button></div>
        </div>
      })}</div>
      <button className="dg-back" onClick={add} disabled={blocks.length >= 12}>+ Tambah Area</button>
      <p>{blocks.length}/12 area · {total}/2.000 petak dasar</p>
      <div className="dg-card"><h3>Pratinjau Area {block.code}</h3>
        <div className="dg-legend"><span>□ Aktif</span><span>▧ Jalan / nonaktif</span><span className="dg-stock-label">■ Terisi pada salah satu tingkat</span></div>
        <div className="dg-map" tabIndex={0} role="region" aria-label="Pratinjau layout, geser untuk melihat semua petak">
          <table><thead><tr><th>Slot / Baris</th>{sequence(block.rows).map(row => <th key={row}>B{row}</th>)}</tr></thead>
            <tbody>{sequence(block.bays).map(bay => <tr key={bay}><th>S{bay}</th>{sequence(block.rows).map(row => {
              const p = positions.find(p => p.block === block.code && p.row === row && bay >= p.bay && bay < p.bay + p.span)
              const disabled = block.disabled.some(d => d.bay === bay && d.row === row)
              return <td key={row}><button type="button" className={`dg-slot ${p ? 'dg-stock' : disabled ? 'dg-blocked' : ''}`} aria-pressed={disabled} aria-label={`Slot ${bay}, baris ${row}: ${p ? 'terisi' : disabled ? 'nonaktif' : 'aktif'}`} onClick={() => toggle(bay, row)} disabled={!!p}>{p ? p.container_number : disabled ? 'Jalan' : 'Aktif'}</button></td>
            })}</tr>)}</tbody>
          </table>
        </div>
      </div>
      {error && <div className="dg-error" role="alert">{error}</div>}
      <div className="dg-editor-save"><p role="status">{saving ? 'Menyimpan layout...' : dirty ? 'Ada perubahan belum disimpan.' : 'Layout sesuai data tersimpan.'}</p><div className="dg-editor-actions"><button className="dg-primary" onClick={save} disabled={!dirty || total > 2000}>Simpan Layout Gudang</button><button onClick={cancel}>Batal</button></div></div>
    </fieldset>
  </div>
}
