import axios from 'axios'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'

export const HOSTED_SHARED_API_URL =
  'https://ais-pre-t75a7iun6k5wfaxunnkfcc-557949178025.asia-northeast1.run.app/api'

export const HOSTED_DEV_API_URL =
  'https://ais-dev-t75a7iun6k5wfaxunnkfcc-557949178025.asia-northeast1.run.app/api'

const STORAGE_KEY_API_URL = 'drivemitra_api_base_url'

export function detectLocalLanApiUrl() {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    Constants.manifest2?.extra?.expoGo?.debuggerHost ??
    null
  if (!hostUri || typeof hostUri !== 'string') return null
  const host = hostUri.split(':')[0]
  if (!host || host === 'localhost' || host === '127.0.0.1') return null
  return `http://${host}:3000/api`
}

export function getDefaultApiBaseUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/+$/, '')
  }
  return HOSTED_SHARED_API_URL
}

let activeApiBaseUrl = getDefaultApiBaseUrl()

export async function initializeApiBaseUrl() {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY_API_URL)
    if (saved && saved.trim()) {
      activeApiBaseUrl = saved.trim().replace(/\/+$/, '')
    }
  } catch {
    // ignore
  }
  apiClient.defaults.baseURL = activeApiBaseUrl
  return activeApiBaseUrl
}

export function getApiBaseUrl() {
  return activeApiBaseUrl
}

export async function setApiBaseUrl(url) {
  const cleaned = String(url ?? '').trim().replace(/\/+$/, '')
  if (!cleaned) return activeApiBaseUrl
  activeApiBaseUrl = cleaned
  apiClient.defaults.baseURL = cleaned
  try {
    await AsyncStorage.setItem(STORAGE_KEY_API_URL, cleaned)
  } catch {
    // ignore
  }
  return cleaned
}

export const apiClient = axios.create({
  baseURL: activeApiBaseUrl,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

apiClient.interceptors.request.use(
  async (config) => {
    config.baseURL = activeApiBaseUrl
    try {
      const token = await AsyncStorage.getItem('drivemitra_auth_token')
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
    } catch {
      // ignore
    }
    return config
  },
  (error) => Promise.reject(error),
)

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('drivemitra_auth_token')
      await AsyncStorage.removeItem('drivemitra_user')
    }
    return Promise.reject(error)
  },
)
