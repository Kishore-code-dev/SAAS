import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { apiClient } from '../services/api'

export const useAuthStore = create((set, get) => ({
  user: null,
  token: null,
  role: 'viewer',
  organization: null,
  isLoading: true,
  isAuthenticated: false,

  initializeAuth: async () => {
    try {
      const token = await AsyncStorage.getItem('drivemitra_auth_token')
      const userStr = await AsyncStorage.getItem('drivemitra_user')
      if (token && userStr) {
        const user = JSON.parse(userStr)
        set({
          token,
          user,
          role: user.role ?? 'viewer',
          organization: user.organization ?? null,
          isAuthenticated: true,
          isLoading: false,
        })
      } else {
        set({ isLoading: false, isAuthenticated: false })
      }
    } catch {
      set({ isLoading: false, isAuthenticated: false })
    }
  },

  login: async (username, password) => {
    try {
      const res = await apiClient.post('/auth/login', { username, password })
      const { token, user } = res.data
      await AsyncStorage.setItem('drivemitra_auth_token', token)
      await AsyncStorage.setItem('drivemitra_user', JSON.stringify(user))
      set({
        token,
        user,
        role: user.role ?? 'viewer',
        organization: user.organization ?? null,
        isAuthenticated: true,
      })
      return { success: true }
    } catch (err) {
      return {
        success: false,
        message: err.response?.data?.error ?? 'Invalid credentials or network failure.',
      }
    }
  },

  logout: async () => {
    try {
      await AsyncStorage.removeItem('drivemitra_auth_token')
      await AsyncStorage.removeItem('drivemitra_user')
    } catch {
      // ignore
    }
    set({ user: null, token: null, role: 'viewer', organization: null, isAuthenticated: false })
  },
}))
