import { YANDEX_MAPS_API_KEY as LOCAL_YANDEX_MAPS_API_KEY } from './yandex.local.js'

/**
 * Ключ для JavaScript API Яндекс Карт лучше хранить в `src/config/yandex.local.js`
 * или передавать через `VITE_YANDEX_MAPS_API_KEY` в `.env.local`.
 */
export const YANDEX_MAPS_API_KEY = LOCAL_YANDEX_MAPS_API_KEY

export function getYandexMapsApiKey() {
  const fromEnv = typeof import.meta !== 'undefined' && import.meta.env?.VITE_YANDEX_MAPS_API_KEY
  if (fromEnv && String(fromEnv).trim()) return String(fromEnv).trim()
  return String(YANDEX_MAPS_API_KEY || '').trim()
}
