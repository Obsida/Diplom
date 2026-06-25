import { useEffect, useRef, useState } from 'react'
import { getYandexMapsApiKey } from '../config/yandexMaps.apikey.js'

const YMAPS_SCRIPT_ID = 'yandex-maps-api-2.1'

function loadYandexMapsScript(apiKey) {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'))
  if (window.ymaps) return Promise.resolve()

  return new Promise((resolve, reject) => {
    let script = document.getElementById(YMAPS_SCRIPT_ID)
    if (!script) {
      script = document.createElement('script')
      script.id = YMAPS_SCRIPT_ID
      script.type = 'text/javascript'
      script.async = true
      script.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(apiKey)}&lang=ru_RU`
      document.head.appendChild(script)
    }

    if (window.ymaps) {
      resolve()
      return
    }

    const onLoad = () => {
      script.removeEventListener('load', onLoad)
      script.removeEventListener('error', onError)
      resolve()
    }
    const onError = () => {
      script.removeEventListener('load', onLoad)
      script.removeEventListener('error', onError)
      reject(new Error('Не удалось загрузить скрипт Яндекс.Карт'))
    }
    script.addEventListener('load', onLoad)
    script.addEventListener('error', onError)
    queueMicrotask(() => {
      if (window.ymaps) onLoad()
    })
  })
}

const DEFAULT_CENTER = [55.751574, 37.573856]

export default function YandexDeliveryMap({ value, onChange, initialAddress }) {
  const apiKey = getYandexMapsApiKey()
  const containerRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const placemarkRef = useRef(null)
  const onChangeRef = useRef(onChange)
  const [loadError, setLoadError] = useState('')
  const [mapReady, setMapReady] = useState(false)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (!apiKey) {
      return undefined
    }

    let cancelled = false
    const rootContainer = containerRef.current

    const applyCoords = (coords) => {
      if (!window.ymaps || cancelled) return
      window.ymaps.geocode(coords).then((res) => {
        if (cancelled) return
        const obj = res.geoObjects.get(0)
        if (!obj) return
        const line = obj.getAddressLine()
        onChangeRef.current(line)
        if (placemarkRef.current) {
          placemarkRef.current.properties.set({ balloonContent: line })
        }
      }).catch(() => {})
    }

    loadYandexMapsScript(apiKey)
      .then(() => {
        if (cancelled || !rootContainer) return
        window.ymaps.ready(() => {
          if (cancelled || !rootContainer) return

          const map = new window.ymaps.Map(rootContainer, {
            center: DEFAULT_CENTER,
            zoom: 11,
            controls: ['zoomControl', 'searchControl', 'geolocationControl', 'fullscreenControl'],
          })
          mapInstanceRef.current = map

          const placemark = new window.ymaps.Placemark(map.getCenter(), {
            balloonContent: 'Выберите точку на карте или перетащите метку',
          }, {
            preset: 'islands#redDotIcon',
            draggable: true,
          })
          placemarkRef.current = placemark
          map.geoObjects.add(placemark)

          placemark.events.add('dragend', () => {
            applyCoords(placemark.geometry.getCoordinates())
          })

          map.events.add('click', (e) => {
            const coords = e.get('coords')
            placemark.geometry.setCoordinates(coords)
            applyCoords(coords)
          })

          const seed = (initialAddress || '').trim()
          if (seed) {
            window.ymaps.geocode(seed).then((res) => {
              if (cancelled) return
              const first = res.geoObjects.get(0)
              if (!first) return
              const c = first.geometry.getCoordinates()
              map.setCenter(c, 16)
              placemark.geometry.setCoordinates(c)
              const line = first.getAddressLine()
              onChangeRef.current(line)
              placemark.properties.set({ balloonContent: line })
            }).catch(() => {})
          } else {
            applyCoords(placemark.geometry.getCoordinates())
          }

          setMapReady(true)
          setLoadError('')
        })
      })
      .catch((e) => {
        if (!cancelled) {
          setLoadError(e?.message || 'Ошибка загрузки карт')
          setMapReady(false)
        }
      })

    return () => {
      cancelled = true
      placemarkRef.current = null
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.destroy()
        } catch {
          /* noop */
        }
        mapInstanceRef.current = null
      }
      if (rootContainer) {
        rootContainer.innerHTML = ''
      }
      setMapReady(false)
    }
  }, [apiKey, initialAddress])

  if (!apiKey) {
    return (
      <div className="checkout-map checkout-map--fallback">
        <p className="checkout-map__hint">
          Укажите ключ API Яндекс.Карт в файле{' '}
          <code className="checkout-map__code">src/config/yandexMaps.apikey.js</code>
          {' '}или переменную <code className="checkout-map__code">VITE_YANDEX_MAPS_API_KEY</code> в <code className="checkout-map__code">.env</code>.
        </p>
        <label className="checkout-map__field">
          <span className="checkout-map__label">Адрес доставки (вручную)</span>
          <textarea
            className="checkout-map__textarea"
            rows={3}
            required
            placeholder="Город, улица, дом, квартира"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </label>
      </div>
    )
  }

  return (
    <div className="checkout-map">
      {loadError ? <p className="checkout-map__error" role="alert">{loadError}</p> : null}
      <div
        ref={containerRef}
        className={`checkout-map__canvas${loadError ? ' checkout-map__canvas--hidden' : ''}`}
        aria-label="Карта выбора адреса доставки"
      />
      {!mapReady && !loadError ? <p className="checkout-map__loading">Загрузка карты…</p> : null}
      <label className="checkout-map__field">
        <span className="checkout-map__label">Адрес по карте</span>
        <input
          className="checkout-map__textarea"
          rows={2}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Кликните по карте или перетащите метку; при необходимости уточните адрес"
        />
      </label>
      {/* <p className="checkout-map__tip">Клик по карте или строка поиска сверху — чтобы выбрать адрес доставки.</p> */}
    </div>
  )
}
