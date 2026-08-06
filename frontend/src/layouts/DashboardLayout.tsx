
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth.store'
import { Home, History, User, LogOut as LogOutIcon, Download } from 'lucide-react'
import { usePWAInstall } from '../hooks/usePWAInstall'

export default function DashboardLayout() {
  const { logout } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()
  const { isInstallable, promptInstall } = usePWAInstall()

  
  return (
    <div className="layout-container">
      <header className="navbar">
        <h2>ALEXINDO YAKINPRIMA</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isInstallable && (
            <button 
              onClick={promptInstall}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: 'var(--accent-color)', color: 'white', border: 'none',
                padding: '6px 12px', borderRadius: '16px', fontSize: '0.8rem', fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Download size={14} /> Install
            </button>
          )}
          <button 
            className="header-logout-btn" 
            onClick={logout}
            title="Logout"
          >
            <LogOutIcon size={20} />
          </button>
        </div>
      </header>
      <main className="main-content">
        <Outlet />
      </main>
      <nav className="bottom-nav">
        <button 
          className={`nav-item ${location.pathname === '/' ? 'active' : ''}`}
          onClick={() => navigate('/')}
        >
          <Home size={22} />
          <span>Beranda</span>
        </button>
        <button 
          className={`nav-item ${location.pathname === '/history' ? 'active' : ''}`}
          onClick={() => navigate('/history')}
        >
          <History size={22} />
          <span>Riwayat</span>
        </button>
        <button 
          className={`nav-item ${location.pathname === '/profile' ? 'active' : ''}`}
          onClick={() => navigate('/profile')}
        >
          <User size={22} />
          <span>Profil</span>
        </button>
      </nav>
    </div>
  )
}
