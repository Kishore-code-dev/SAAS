import axios from 'axios'
import AsyncStorage from '@react-native-async-storage/async-storage'

const API_BASE_URL = 'https://ais-dev-t75a7iun6k5wfaxunnkfcc-557949178025.asia-northeast1.run.app/api'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
})

apiClient.interceptors.request.use(async (config) => {
  try {
    const token = await AsyncStorage.getItem('drivemitra_auth_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  } catch {
    // ignore
  }
  return config
}, (error) => Promise.reject(error))

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('drivemitra_auth_token')
      await AsyncStorage.removeItem('drivemitra_user')
    }
    return Promise.reject(error)
  }
)
