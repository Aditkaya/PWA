import { useEffect, useRef, useState } from 'react'
import { Printer, X } from 'lucide-react'

interface Props {
  id: number
  kind: 'foto' | 'surat'
  token: string | null
  onClose: () => void
}

export default function AssetReceiptViewer({ id, kind, token, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const [content, setContent] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [frameReady, setFrameReady] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => { dialog.current?.showModal() }, [])
  useEffect(() => {
    const controller = new AbortController()
    let url = ''
    setLoading(true)
    setFrameReady(false)
    setContent('')
    setError('')
    fetch(`/api/tanda-terima-asset/${id}/${kind}`, { signal: controller.signal, cache: 'no-store', headers: { Authorization: `Bearer ${token || ''}` } })
      .then(async response => {
        if (!response.ok) {
          const body = await response.json()
          throw new Error(body.message || 'Data gagal dimuat.')
        }
        if (kind === 'surat') return response.text()
        const blob = await response.blob()
        if (controller.signal.aborted) return ''
        url = URL.createObjectURL(blob)
        return url
      })
      .then(value => { if (!controller.signal.aborted) setContent(value) })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Gagal memuat data.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url) }
  }, [id, kind, token, retry])
  return <dialog ref={dialog} className="asset-receipt-modal asset-receipt-viewer" aria-labelledby="asset-viewer-title" onCancel={event => { event.preventDefault(); onClose() }}>
    <div className="asset-receipt-modal-header"><h2 id="asset-viewer-title">{kind === 'surat' ? 'Surat Tanda Terima Asset' : 'Foto Asset Tersimpan'}</h2><button onClick={onClose} aria-label="Tutup pratinjau"><X size={20} /></button></div>
    {loading ? <p role="status">Memuat {kind}...</p> : error ? <div role="alert"><p>{error}</p><button onClick={() => setRetry(value => value + 1)}>Coba lagi</button></div>
      : kind === 'surat' ? <>
        <button disabled={!frameReady} onClick={() => frame.current?.contentWindow?.print()}><Printer size={16} /> Cetak / Simpan PDF</button>
        <iframe ref={frame} title="Surat Tanda Terima Asset" srcDoc={content} sandbox="allow-same-origin allow-modals" onLoad={() => setFrameReady(true)} />
      </> : <img className="asset-receipt-saved-photo" src={content} alt="Foto asset tersimpan" />}
  </dialog>
}
