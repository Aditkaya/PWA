import { useEffect, useRef, useState } from 'react'
import { Camera, RefreshCw, X } from 'lucide-react'

interface Props {
  assetName: string
  onClose: () => void
  onSave: (photo: Blob) => Promise<void>
}

export default function AssetPhotoCamera({ assetName, onClose, onSave }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [preview, setPreview] = useState('')
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)

  useEffect(() => { dialog.current?.showModal() }, [])
  useEffect(() => {
    if (!photo) { setPreview(''); return }
    const url = URL.createObjectURL(photo)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  useEffect(() => {
    if (photo) return
    let cancelled = false
    let stream: MediaStream | undefined
    setReady(false)
    setError('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Kamera tidak tersedia. Buka aplikasi melalui HTTPS atau localhost dan izinkan akses kamera.')
      return
    }
    navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1600 }, height: { ideal: 1200 } } })
      .then(result => {
        if (cancelled) { result.getTracks().forEach(track => track.stop()); return }
        stream = result
        if (video.current) video.current.srcObject = result
      })
      .catch(() => { if (!cancelled) setError('Kamera gagal dibuka. Izinkan kamera dan pastikan kamera tidak sedang digunakan aplikasi lain.') })
    return () => { cancelled = true; stream?.getTracks().forEach(track => track.stop()) }
  }, [photo, retry])

  const capture = () => {
    const source = video.current
    if (!source?.videoWidth || !ready || busy) return
    const canvas = document.createElement('canvas')
    const scale = Math.min(1, 1600 / Math.max(source.videoWidth, source.videoHeight))
    canvas.width = Math.round(source.videoWidth * scale)
    canvas.height = Math.round(source.videoHeight * scale)
    canvas.getContext('2d')?.drawImage(source, 0, 0, canvas.width, canvas.height)
    setBusy(true)
    canvas.toBlob(result => {
      setBusy(false)
      if (result) setPhoto(result)
      else setError('Foto gagal diambil. Silakan coba lagi.')
    }, 'image/jpeg', .85)
  }

  const save = async () => {
    if (!photo || busy) return
    setBusy(true)
    setError('')
    try { await onSave(photo) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Foto gagal disimpan.') }
    finally { setBusy(false) }
  }

  return <dialog ref={dialog} className="asset-receipt-modal" aria-labelledby="asset-camera-title" onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
    <div className="asset-receipt-modal-header"><h2 id="asset-camera-title">Foto Asset</h2><button onClick={onClose} disabled={busy} aria-label="Tutup kamera"><X size={20} /></button></div>
    <p>{assetName} — Pastikan asset terlihat jelas sebelum menyimpan foto.</p>
    <div className="asset-receipt-camera">
      {photo ? preview && <img src={preview} alt="Pratinjau foto asset" /> : <video ref={video} autoPlay playsInline muted onLoadedMetadata={() => setReady(true)} onError={() => setError('Pratinjau kamera tidak dapat diputar. Silakan coba lagi.')} />}
    </div>
    {error && <p role="alert" className="asset-receipt-error">{error}</p>}
    {!photo && !ready && !error && <p role="status">Membuka kamera...</p>}
    <div className="asset-receipt-modal-actions">
      {photo ? <><button disabled={busy} onClick={() => { setPhoto(null); setError('') }}><RefreshCw size={16} /> Foto Ulang</button><button disabled={busy} onClick={save}>{busy ? 'Menyimpan...' : 'Simpan Foto'}</button></>
        : <><button disabled={!ready || busy} onClick={capture}><Camera size={16} /> Ambil Foto</button>{error && <button onClick={() => setRetry(value => value + 1)}>Coba Kamera Lagi</button>}</>}
    </div>
  </dialog>
}
