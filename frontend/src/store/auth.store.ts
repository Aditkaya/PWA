import { create } from 'zustand'
import { authService } from '../services/auth.service'

interface User {
  id: number
  username: string
  name?: string
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (u: string, p: string) => Promise<void>
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => {
  const storedToken = localStorage.getItem('token')
  const storedUser = localStorage.getItem('user')
  
  return {
    user: storedUser ? JSON.parse(storedUser) : null,
    token: storedToken,
    isAuthenticated: !!storedToken,
    
    login: async (username, password) => {
      const response = await authService.login(username, password)
      const { token, user } = response.data
      
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))
      
      set({ user, token, isAuthenticated: true })
    },
    
    logout: () => {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      set({ user: null, token: null, isAuthenticated: false })
    }
  }
})
