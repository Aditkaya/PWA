import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import * as faceapi from 'face-api.js'
import Cropper from 'react-easy-crop'
import getCroppedImg from '../../utils/cropImage'
import { User, Mail, Briefcase, Phone, MapPin, Key, ChevronRight, Loader2, Camera, X, Save, Eye, EyeOff, Lock, Trash2 } from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import { useLangStore } from '../../store/lang.store'
import { translations } from '../../utils/translations'
import { useToast } from '../../contexts/ToastContext'

interface KaryawanData {
  nik: string
  nama_lengkap: string
  email: string
  no_hp: string
  cabang: string
  pekerjaan: string
  divisi: string
  avatar_url?: string
  avatar_updated_at?: string
}

type ModalType = 'editProfile' | 'changePassword' | null

export default function Profile() {
  const { user } = useAuthStore()
  const [profileData, setProfileData] = useState<KaryawanData | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [isViewerOpen, setIsViewerOpen] = useState(false)
  const [activeModal, setActiveModal] = useState<ModalType>(null)
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Cropper state
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)
  const [isCropping, setIsCropping] = useState(false)

  // Edit profile form state
  const [editForm, setEditForm] = useState({ nama_lengkap: '', email: '', no_hp: '' })
  const [savingProfile, setSavingProfile] = useState(false)

  // Change password form state
  const [pwForm, setPwForm] = useState({ old_password: '', new_password: '', confirm_password: '' })
  const [showPw, setShowPw] = useState({ old: false, new: false, confirm: false })
  const [savingPw, setSavingPw] = useState(false)

  const { lang } = useLangStore()
  const t = translations[lang]
  const { showToast } = useToast()

  const [modelsLoaded, setModelsLoaded] = useState(false)

  useEffect(() => {
    const loadModels = async () => {
      try {
        await faceapi.nets.ssdMobilenetv1.loadFromUri('/models')
        setModelsLoaded(true)
      } catch (error) {
        console.error("Gagal memuat model face-api", error)
      }
    }
    loadModels()
  }, [])

  const fetchProfile = async () => {
    if (!user?.id) return
    try {
      const response = await fetch(`/api/profile?user_id=${user.id}`)
      if (response.ok) {
        const result = await response.json()
        setProfileData(result.data)
      }
    } catch (error) {
      console.error("Failed to fetch profile", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchProfile() }, [user])

  const openEditProfile = () => {
    setEditForm({
      nama_lengkap: profileData?.nama_lengkap || '',
      email: profileData?.email || '',
      no_hp: profileData?.no_hp || '',
    })
    setActiveModal('editProfile')
  }

  const handleSaveProfile = async () => {
    if (!user?.id) return
    setSavingProfile(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, ...editForm }),
      })
      const result = await res.json()
      if (res.ok) {
        showToast('Profil berhasil diperbarui!', 'success')
        setActiveModal(null)
        fetchProfile()
      } else {
        showToast(result.message || 'Gagal memperbarui profil', 'error')
      }
    } catch {
      showToast('Terjadi kesalahan sistem', 'error')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleSavePassword = async () => {
    if (!user?.id) return
    if (pwForm.new_password !== pwForm.confirm_password) {
      showToast('Konfirmasi password tidak cocok', 'error')
      return
    }
    if (pwForm.new_password.length < 6) {
      showToast('Password baru minimal 6 karakter', 'error')
      return
    }
    setSavingPw(true)
    try {
      const res = await fetch('/api/profile/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, old_password: pwForm.old_password, new_password: pwForm.new_password }),
      })
      const result = await res.json()
      if (res.ok) {
        showToast('Password berhasil diperbarui!', 'success')
        setActiveModal(null)
        setPwForm({ old_password: '', new_password: '', confirm_password: '' })
      } else {
        showToast(result.message || 'Gagal memperbarui password', 'error')
      }
    } catch {
      showToast('Terjadi kesalahan sistem', 'error')
    } finally {
      setSavingPw(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return
    
    // reset input so the same file can be selected again
    e.target.value = ''

    const objectUrl = URL.createObjectURL(file)
    setCropImageSrc(objectUrl)
    setIsCropping(true)
  }

  const onCropComplete = (_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }

  const handleSaveCrop = async () => {
    if (!cropImageSrc || !croppedAreaPixels || !user?.id) return
    
    setUploading(true)
    setIsCropping(false)

    if (!modelsLoaded) {
      showToast('AI Model belum siap. Silakan coba sebentar lagi.', 'error')
      setUploading(false)
      return
    }

    try {
      const croppedFile = await getCroppedImg(cropImageSrc, croppedAreaPixels)
      if (!croppedFile) throw new Error("Gagal memotong gambar")

      const objectUrl = URL.createObjectURL(croppedFile)
      const img = new Image()
      img.src = objectUrl

      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
      })

      const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.85 })
      const detection = await faceapi.detectSingleFace(img, options)
      URL.revokeObjectURL(objectUrl)

      if (!detection) {
        showToast('Wajah tidak terdeteksi dengan jelas. Harap pastikan foto terang dan wajah terlihat jelas.', 'error')
        setUploading(false)
        return
      }

      const faceWidthRatio = detection.box.width / img.width
      const faceHeightRatio = detection.box.height / img.height

      if (faceWidthRatio < 0.2 && faceHeightRatio < 0.2) {
        showToast('Posisi wajah terlalu jauh/kecil. Gunakan pas foto atau selfie yang lebih fokus pada wajah Anda.', 'error')
        setUploading(false)
        return
      }

      // 2. Upload to server
      const formData = new FormData()
      formData.append('avatar', croppedFile)
      formData.append('user_id', user.id.toString())
      
      const response = await fetch('/api/profile/upload', { method: 'POST', body: formData })
      if (response.ok) {
        const result = await response.json()
        setProfileData(prev => prev ? { ...prev, avatar_url: result.avatar_url, avatar_updated_at: new Date().toISOString() } : null)
        showToast('Foto profil berhasil diunggah', 'success')
      } else {
        const result = await response.json()
        showToast(result.message || 'Gagal mengupload foto', 'error')
      }
    } catch {
      showToast('Terjadi kesalahan sistem', 'error')
    } finally {
      setUploading(false)
      setCropImageSrc(null)
    }
  }

  const handleDeleteAvatar = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!user?.id) return
    
    if (!window.confirm('Apakah Anda yakin ingin menghapus foto profil ini?')) return
    
    setUploading(true)
    try {
      const response = await fetch('/api/profile/avatar', { 
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id })
      })
      if (response.ok) {
        setProfileData(prev => prev ? { ...prev, avatar_url: undefined, avatar_updated_at: undefined } : null)
        showToast('Foto profil berhasil dihapus', 'success')
      } else {
        const result = await response.json()
        showToast(result.message || 'Gagal menghapus foto', 'error')
      }
    } catch {
      showToast('Terjadi kesalahan sistem', 'error')
    } finally {
      setUploading(false)
    }
  }

  const isProfileLocked = () => {
    return false
  }

  const getUnlockDate = () => {
    if (!profileData?.avatar_updated_at) return ''
    const lastUpdate = new Date(profileData.avatar_updated_at)
    lastUpdate.setFullYear(lastUpdate.getFullYear() + 1)
    return lastUpdate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const triggerUpload = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isProfileLocked()) {
      showToast(`Foto profil dikunci hingga ${getUnlockDate()}`, 'error')
      return
    }
    if (fileInputRef.current && !uploading) fileInputRef.current.click()
  }

  const handleAvatarActionClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isProfileLocked()) {
      showToast(`Foto profil dikunci hingga ${getUnlockDate()}`, 'error')
      return
    }
    
    if (profileData?.avatar_url) {
      setIsAvatarMenuOpen(!isAvatarMenuOpen)
    } else {
      triggerUpload(e)
    }
  }

  const handleAvatarClick = () => {
    if (profileData?.avatar_url) {
      setIsViewerOpen(true)
    } else {
      if (isProfileLocked()) {
        showToast(`Foto profil dikunci hingga ${getUnlockDate()}`, 'error')
        return
      }
      if (fileInputRef.current && !uploading) fileInputRef.current.click()
    }
  }

  if (loading) {
    return (
      <div className="profile-page fade-in" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent-color)' }} />
      </div>
    )
  }

  const name = profileData?.nama_lengkap || user?.username || t.employee
  const initials = name.substring(0, 2).toUpperCase()
  const role = profileData ? `${profileData.pekerjaan || 'Staf'} - ${profileData.divisi || 'Umum'}` : t.staffGeneral

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1px solid var(--glass-border)',
    background: 'var(--glass-bg)', color: 'var(--text-primary)', fontSize: '0.9rem',
    outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '0.78rem', fontWeight: 600,
    color: 'var(--text-secondary)', marginBottom: '6px', letterSpacing: '0.3px',
  }

  return (
    <div className="profile-page fade-in">
      {/* Photo Viewer Modal */}
      {isViewerOpen && profileData?.avatar_url && (
        <div className="photo-viewer-modal fade-in" onClick={() => setIsViewerOpen(false)}>
          <button className="viewer-close-btn" onClick={() => setIsViewerOpen(false)}>
            <X size={28} />
          </button>
          <img 
            src={profileData.avatar_url} 
            alt="Profile Full" 
            className="viewer-image" 
            onClick={(e) => e.stopPropagation()} 
            style={{ borderRadius: '50%', objectFit: 'cover', width: '250px', height: '250px' }}
          />
        </div>
      )}

      {/* Cropper Modal */}
      {isCropping && cropImageSrc && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 999999, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.5)', position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}>
            <h3 style={{ margin: 0, color: '#fff', fontSize: '1.1rem' }}>Sesuaikan Foto Profil</h3>
            <button onClick={() => { setIsCropping(false); setCropImageSrc(null) }} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
              <X size={28} />
            </button>
          </div>
          
          <div style={{ flex: 1, position: 'relative' }}>
            <Cropper
              image={cropImageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              onCropChange={setCrop}
              onCropComplete={onCropComplete}
              onZoomChange={setZoom}
              cropShape="round"
              showGrid={false}
            />
          </div>
          
          <div style={{ padding: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#111', paddingBottom: 'env(safe-area-inset-bottom, 24px)', position: 'relative', zIndex: 10 }}>
            <button 
              onClick={handleSaveCrop}
              style={{ width: '100%', padding: '14px', background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}
            >
              Simpan & Verifikasi
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Profile Modal */}
      {activeModal === 'editProfile' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: 'var(--panel-bg)', border: '1px solid var(--glass-border)', borderRadius: '20px', padding: '28px 24px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }} className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Edit Profil</h3>
              <button onClick={() => setActiveModal(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}>
                <X size={22} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Nama Lengkap</label>
                <input style={inputStyle} value={editForm.nama_lengkap} onChange={e => setEditForm(p => ({ ...p, nama_lengkap: e.target.value }))} placeholder="Masukkan nama lengkap" />
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input style={inputStyle} type="email" value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} placeholder="Masukkan email" />
              </div>
              <div>
                <label style={labelStyle}>No. HP / WhatsApp</label>
                <input style={inputStyle} type="tel" value={editForm.no_hp} onChange={e => setEditForm(p => ({ ...p, no_hp: e.target.value }))} placeholder="Masukkan nomor HP" />
              </div>
              <button
                onClick={handleSaveProfile}
                disabled={savingProfile}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '13px', background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 700, fontSize: '0.95rem', cursor: savingProfile ? 'not-allowed' : 'pointer', opacity: savingProfile ? 0.7 : 1, marginTop: '4px' }}
              >
                {savingProfile ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                {savingProfile ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {activeModal === 'changePassword' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: 'var(--panel-bg)', border: '1px solid var(--glass-border)', borderRadius: '20px', padding: '28px 24px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }} className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Ganti Password</h3>
              <button onClick={() => { setActiveModal(null); setPwForm({ old_password: '', new_password: '', confirm_password: '' }) }} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}>
                <X size={22} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {(['old', 'new', 'confirm'] as const).map((field) => {
                const labels = { old: 'Password Lama', new: 'Password Baru', confirm: 'Konfirmasi Password Baru' }
                const keys = { old: 'old_password', new: 'new_password', confirm: 'confirm_password' } as const
                return (
                  <div key={field}>
                    <label style={labelStyle}>{labels[field]}</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        style={{ ...inputStyle, paddingRight: '44px' }}
                        type={showPw[field] ? 'text' : 'password'}
                        value={pwForm[keys[field]]}
                        onChange={e => setPwForm(p => ({ ...p, [keys[field]]: e.target.value }))}
                        placeholder={`Masukkan ${labels[field].toLowerCase()}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(p => ({ ...p, [field]: !p[field] }))}
                        style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px' }}
                      >
                        {showPw[field] ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                  </div>
                )
              })}
              <button
                onClick={handleSavePassword}
                disabled={savingPw}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '13px', background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 700, fontSize: '0.95rem', cursor: savingPw ? 'not-allowed' : 'pointer', opacity: savingPw ? 0.7 : 1, marginTop: '4px' }}
              >
                {savingPw ? <Loader2 size={18} className="animate-spin" /> : <Key size={18} />}
                {savingPw ? 'Menyimpan...' : 'Perbarui Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="profile-header glass-panel">
        <div className="profile-avatar-container">
          <div className="profile-avatar-wrapper" onClick={handleAvatarClick} style={{ position: 'relative' }}>
            <div className="profile-avatar-large">
              {profileData?.avatar_url ? (
                <img src={profileData.avatar_url} alt="Profile" className="profile-avatar-img" />
              ) : (
                initials
              )}
            </div>
            {uploading && (
              <div className="avatar-loading-overlay">
                <Loader2 size={24} className="animate-spin" />
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px', position: 'absolute', bottom: '0', right: '-10px' }}>
            <button 
              onClick={handleAvatarActionClick} 
              style={{ width: '36px', height: '36px', borderRadius: '50%', background: isProfileLocked() ? '#ef4444' : 'var(--accent-color)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}
            >
              {isProfileLocked() ? <Lock size={16} /> : <Camera size={16} />}
            </button>
            {isAvatarMenuOpen && (
              <div className="fade-in" style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', background: 'var(--panel-bg)', borderRadius: '12px', padding: '6px', boxShadow: '0 10px 30px rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', zIndex: 100, minWidth: '150px' }}>
                <button 
                  onClick={(e) => { setIsAvatarMenuOpen(false); triggerUpload(e); }} 
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', borderRadius: '8px', textAlign: 'left', fontSize: '0.85rem', fontWeight: 500 }}
                >
                  <Camera size={16} /> Ganti Foto
                </button>
                <button 
                  onClick={(e) => { setIsAvatarMenuOpen(false); handleDeleteAvatar(e); }} 
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', borderRadius: '8px', textAlign: 'left', fontSize: '0.85rem', fontWeight: 500 }}
                >
                  <Trash2 size={16} /> Hapus Foto
                </button>
              </div>
            )}
          </div>
        </div>
        <input 
          type="file" 
          accept="image/*" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          onChange={handleFileChange} 
        />
        <h2>{name}</h2>
        <p className="profile-role">{role}</p>
      </div>

      <div className="profile-section glass-panel">
        <h3 className="section-title">{t.personalInfo}</h3>
        
        <div className="info-list">
          <div className="info-item">
            <div className="info-icon"><Briefcase size={20} /></div>
            <div className="info-content">
              <span className="info-label">{t.employeeId}</span>
              <span className="info-value">{profileData?.nik || '-'}</span>
            </div>
          </div>
          
          <div className="info-item">
            <div className="info-icon"><Mail size={20} /></div>
            <div className="info-content">
              <span className="info-label">{t.email}</span>
              <span className="info-value">{profileData?.email || '-'}</span>
            </div>
          </div>
          
          <div className="info-item">
            <div className="info-icon"><Phone size={20} /></div>
            <div className="info-content">
              <span className="info-label">{t.phone}</span>
              <span className="info-value">{profileData?.no_hp || '-'}</span>
            </div>
          </div>

          <div className="info-item">
            <div className="info-icon"><MapPin size={20} /></div>
            <div className="info-content">
              <span className="info-label">{t.branchAddress}</span>
              <span className="info-value">{profileData?.cabang || '-'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="profile-section glass-panel">
        <h3 className="section-title">{t.accountSettings}</h3>
        <div className="settings-list">
          <button className="setting-btn" onClick={openEditProfile}>
            <div className="setting-btn-left">
              <User size={20} />
              <span>{t.editProfile}</span>
            </div>
            <ChevronRight size={20} />
          </button>
          <button className="setting-btn" onClick={() => setActiveModal('changePassword')}>
            <div className="setting-btn-left">
              <Key size={20} />
              <span>{t.changePassword}</span>
            </div>
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </div>
  )
}
