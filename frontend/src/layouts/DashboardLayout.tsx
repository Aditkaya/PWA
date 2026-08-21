
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth.store'
import { Home, History, User, LogOut as LogOutIcon, Download, Sun, Moon, Globe, MoreVertical, ClipboardCheck } from 'lucide-react'
import { usePWAInstall } from '../hooks/usePWAInstall'
import { useState, useEffect, useRef } from 'react'
import { useLangStore } from '../store/lang.store'
import { useModeStore } from '../store/mode.store'
import { translations } from '../utils/translations'
import { useToast } from '../contexts/ToastContext'

export default function DashboardLayout() {
  const { logout } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()
  const { isInstallable, promptInstall } = usePWAInstall()
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark')
  
  const { lang, toggleLang } = useLangStore()
  const { isOvertimeMode, toggleOvertimeMode } = useModeStore()
  const t = translations[lang]
  const { showToast } = useToast()

  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const [userGroup, setUserGroup] = useState('')
  const [userPekerjaan, setUserPekerjaan] = useState('')
  const { user } = useAuthStore()

  useEffect(() => {
    if (user?.id) {
      fetch(`/api/profile?user_id=${user.id}`)
        .then(res => res.json())
        .then(data => {
          if (data.data) {
            setUserGroup(data.data.grup || '')
            setUserPekerjaan(data.data.pekerjaan || '')
          }
        })
        .catch(err => console.error(err))
    }
  }, [user])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }
  
  return (
    <div className="layout-container">
      <header className="navbar" style={{ position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img src="/logo.png" alt="Logo" style={{ height: '42px', objectFit: 'contain' }} />
          <h2 style={{ fontSize: '1.1rem', lineHeight: '1.2' }}>ALEXINDO YAKINPRIMA</h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isInstallable && (
            <button 
              onClick={promptInstall}
              className="fade-in"
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: 'rgba(56, 189, 248, 0.1)', 
                color: 'var(--accent-color)', 
                border: '1px solid rgba(56, 189, 248, 0.2)',
                padding: '6px 14px', borderRadius: '20px', 
                fontSize: '0.85rem', fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--accent-color)';
                e.currentTarget.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(56, 189, 248, 0.1)';
                e.currentTarget.style.color = 'var(--accent-color)';
              }}
            >
              <Download size={14} /> Install
            </button>
          )}

          <div style={{ position: 'relative' }} ref={menuRef}>
            <button 
              className="header-logout-btn" 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              title="Menu"
            >
              <MoreVertical size={20} strokeWidth={1.5} />
            </button>
            
            {isMenuOpen && (
              <div 
                style={{ 
                  position: 'absolute', top: '100%', right: 0, marginTop: '8px',
                  background: 'var(--panel-bg)', backdropFilter: 'blur(20px)',
                  border: '1px solid var(--glass-border)', borderRadius: '12px',
                  padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px',
                  minWidth: '180px', zIndex: 1000, boxShadow: '0 10px 40px var(--shadow-dark)'
                }}
                className="fade-in"
              >
                <button 
                  onClick={() => { toggleLang(); setIsMenuOpen(false); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', borderRadius: '8px', textAlign: 'left', fontSize: '0.85rem', fontWeight: 500 }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--glass-bg)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <Globe size={18} /> 
                  <span>{lang === 'id' ? 'English' : 'Bahasa Indonesia'}</span>
                </button>
                <button 
                  onClick={() => { toggleTheme(); setIsMenuOpen(false); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', borderRadius: '8px', textAlign: 'left', fontSize: '0.85rem', fontWeight: 500 }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--glass-bg)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                  <span>{theme === 'dark' ? 'Tema Terang' : 'Tema Gelap'}</span>
                </button>
                <button 
                  onClick={() => { 
                    setIsMenuOpen(false);
                    if (!userGroup.toUpperCase().includes('LEMBUR')) {
                      showToast('Mode Lembur terkunci: Karyawan tidak terdaftar di Grup Lembur.', 'error');
                      return;
                    }
                    toggleOvertimeMode(); 
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'transparent', border: 'none', color: isOvertimeMode ? '#fb923c' : 'var(--text-primary)', cursor: 'pointer', borderRadius: '8px', textAlign: 'left', fontSize: '0.85rem', fontWeight: 500, opacity: userGroup.toUpperCase().includes('LEMBUR') ? 1 : 0.5 }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--glass-bg)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <History size={18} />
                  <span>{isOvertimeMode ? t.overtimeMode : t.normalMode}</span>
                </button>
                {(userPekerjaan.trim().toUpperCase() === 'HRD' || userPekerjaan.trim().toUpperCase() === 'IT') && (
                  <>
                    <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '4px 0' }} />
                    <button 
                      onClick={() => { navigate('/hrd/approval'); setIsMenuOpen(false); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', borderRadius: '8px', textAlign: 'left', fontSize: '0.85rem', fontWeight: 500 }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--glass-bg)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <ClipboardCheck size={18} />
                      <span>Persetujuan HRD</span>
                    </button>
                  </>
                )}
                <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '4px 0' }} />
                <button 
                  onClick={() => { logout(); setIsMenuOpen(false); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', borderRadius: '8px', textAlign: 'left', fontSize: '0.85rem', fontWeight: 500 }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <LogOutIcon size={18} />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="main-content page-enter" key={location.pathname}>
        <Outlet />
      </main>
      <nav className="bottom-nav">
        <button 
          className={`nav-item ${location.pathname === '/' ? 'active' : ''}`}
          onClick={() => navigate('/')}
        >
          <Home size={22} />
          <span>{t.home}</span>
        </button>
        <button 
          className={`nav-item ${location.pathname === '/history' ? 'active' : ''}`}
          onClick={() => navigate('/history')}
        >
          <History size={22} />
          <span>{t.history}</span>
        </button>
        <button 
          className={`nav-item ${location.pathname === '/profile' ? 'active' : ''}`}
          onClick={() => navigate('/profile')}
        >
          <User size={22} />
          <span>{t.profile}</span>
        </button>
      </nav>
    </div>
  )
}
