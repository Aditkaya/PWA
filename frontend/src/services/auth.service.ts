import api from './axios'

export const authService = {
  login: (username: string, password: string) => {
    return api.post('/login', { username, password })
  }
}
