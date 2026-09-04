import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import DashboardLayout from './layouts/DashboardLayout'
import Dashboard from './pages/Dashboard/Dashboard'
import History from './pages/History/History'
import Profile from './pages/Profile/Profile'
import Login from './pages/Login/Login'
import HrdApproval from './pages/HrdApproval/HrdApproval'
import Amprahan from './pages/Amprahan/Amprahan'
import AmprahanRequest from './pages/Amprahan/AmprahanRequest'
import TandaTerima from './pages/Amprahan/TandaTerima'
import TandaTerimaDetail from './pages/Amprahan/TandaTerimaDetail'
import PrivateRoute from './routes/PrivateRoute'
import { ToastProvider } from './contexts/ToastContext'
import UpdateNotification from './components/UpdateNotification'

function App() {
  return (
    <ToastProvider>
      <UpdateNotification />
      <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route element={<PrivateRoute />}>
          <Route path="/" element={<DashboardLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="history" element={<History />} />
            <Route path="profile" element={<Profile />} />
            <Route path="hrd/approval" element={<HrdApproval />} />
            <Route path="amprahan" element={<Amprahan />} />
            <Route path="amprahan/request" element={<AmprahanRequest />} />
            <Route path="amprahan/tanda-terima" element={<TandaTerima />} />
            <Route path="amprahan/tanda-terima/detail" element={<TandaTerimaDetail />} />
          </Route>

        </Route>
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </ToastProvider>
  )
}
export default App

