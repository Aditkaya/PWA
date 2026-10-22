import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

interface Props {
  id: number
  token: string | null
  onClose: () => void
}

export default function AssetReceiptViewer({ id, token, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [content, setContent] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)
  useEffect(() => { dialog.current?.showModal() }, [])
  useEffect(() => {
    const controller = new AbortController()
    let url = ''
    setLoading(true)
    setContent('')
    setError('')
    fetch(`/api/tanda-terima-asset/${id}/foto`, { signal: controller.signal, cache: 'no-store', headers: { Authorization: `Bearer ${token || ''}` } })
      .then(async response => {
        if (!response.ok) {
          const body = await response.json()
          throw new Error(body.message || 'Data gagal dimuat.')
        }
        const blob = await response.blob()
        if (controller.signal.aborted) return ''
        url = URL.createObjectURL(blob)
        return url
      })
      .then(value => { if (!controller.signal.aborted) setContent(value) })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Gagal memuat data.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url) }
  }, [id, token, retry])
  return <dialog ref={dialog} className="asset-receipt-modal asset-receipt-viewer" aria-labelledby="asset-viewer-title" onCancel={event => { event.preventDefault(); onClose() }}>
    <div className="asset-receipt-modal-header"><h2 id="asset-viewer-title">Foto Asset Tersimpan</h2><button onClick={onClose} aria-label="Tutup pratinjau"><X size={20} /></button></div>
    {loading ? <p role="status">Memuat foto...</p> : error ? <div role="alert"><p>{error}</p><button onClick={() => setRetry(value => value + 1)}>Coba lagi</button></div>
      : <img className="asset-receipt-saved-photo" src={content} alt="Foto asset tersimpan" />}
  </dialog>
}
