import { useState, useEffect, useRef } from 'react'
import { User, Mail, Briefcase, Phone, MapPin, Key, ChevronRight, Loader2, Camera, X } from 'lucide-react'
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
}

export default function Profile() {
  const { user } = useAuthStore()
  const [profileData, setProfileData] = useState<KaryawanData | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [isViewerOpen, setIsViewerOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { lang } = useLangStore()
  const t = translations[lang]
  const { showToast } = useToast()

  useEffect(() => {
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

    fetchProfile()
  }, [user])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return

    setUploading(true)
    const formData = new FormData()
    formData.append('avatar', file)
    formData.append('user_id', user.id.toString())

    try {
      const response = await fetch('/api/profile/upload', {
        method: 'POST',
        body: formData,
      })
      
      if (response.ok) {
        const result = await response.json()
        setProfileData(prev => prev ? { ...prev, avatar_url: result.avatar_url } : null)
      } else {
        showToast(t.failUpload || 'Gagal mengupload foto', 'error')
      }
    } catch (error) {
      console.error("Upload error:", error)
      showToast(t.errorUpload || 'Terjadi kesalahan sistem', 'error')
    } finally {
      setUploading(false)
    }
  }

  const triggerUpload = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (fileInputRef.current && !uploading) {
      fileInputRef.current.click()
    }
  }

  const handleAvatarClick = () => {
    if (profileData?.avatar_url) {
      setIsViewerOpen(true)
    } else {
      if (fileInputRef.current && !uploading) {
        fileInputRef.current.click()
      }
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

  return (
    <div className="profile-page fade-in">
      {/* Photo Viewer Modal */}
      {isViewerOpen && profileData?.avatar_url && (
        <div className="photo-viewer-modal fade-in" onClick={() => setIsViewerOpen(false)}>
          <button className="viewer-close-btn" onClick={() => setIsViewerOpen(false)}>
            <X size={28} />
          </button>
          <img src={profileData.avatar_url} alt="Profile Full" className="viewer-image" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      <div className="profile-header glass-panel">
        <div className="profile-avatar-container">
          <div className="profile-avatar-wrapper" onClick={handleAvatarClick}>
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
          <button className="avatar-upload-badge" onClick={triggerUpload}>
            <Camera size={16} />
          </button>
        </div>
        
        <input 
          type="file" 
          accept="image/png, image/jpeg, image/jpg" 
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
            <div className="info-icon">
              <Briefcase size={20} />
            </div>
            <div className="info-content">
              <span className="info-label">{t.employeeId}</span>
              <span className="info-value">{profileData?.nik || '-'}</span>
            </div>
          </div>
          
          <div className="info-item">
            <div className="info-icon">
              <Mail size={20} />
            </div>
            <div className="info-content">
              <span className="info-label">{t.email}</span>
              <span className="info-value">{profileData?.email || '-'}</span>
            </div>
          </div>
          
          <div className="info-item">
            <div className="info-icon">
              <Phone size={20} />
            </div>
            <div className="info-content">
              <span className="info-label">{t.phone}</span>
              <span className="info-value">{profileData?.no_hp || '-'}</span>
            </div>
          </div>

          <div className="info-item">
            <div className="info-icon">
              <MapPin size={20} />
            </div>
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
          <button className="setting-btn">
            <div className="setting-btn-left">
              <User size={20} />
              <span>{t.editProfile}</span>
            </div>
            <ChevronRight size={20} />
          </button>
          <button className="setting-btn">
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
