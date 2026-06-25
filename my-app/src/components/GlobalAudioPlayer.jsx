import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchReadingProgressByBook, getAuthToken, listenAudioUrl, upsertReadingProgress } from '../api'
import {
  AUDIO_PLAYER_OPEN_EVENT,
  clearGlobalAudioPlayerState,
  loadGlobalAudioPlayerState,
  saveGlobalAudioPlayerState,
} from '../utils/globalAudioPlayer'

function formatAudioTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const total = Math.floor(sec)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function normalizeTrack(raw) {
  if (!raw) return null

  const bookId = Number(raw.bookId)
  if (Number.isNaN(bookId)) return null

  return {
    bookId,
    title: String(raw.title || 'Аудиокнига'),
    author: String(raw.author || 'Неизвестный автор'),
    cover: String(raw.cover || ''),
  }
}

export default function GlobalAudioPlayer() {
  const [track, setTrack] = useState(null)
  const [playerOpen, setPlayerOpen] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(0.8)
  const [audioBlobUrl, setAudioBlobUrl] = useState('')
  const [audioLoading, setAudioLoading] = useState(false)
  const [audioLoadError, setAudioLoadError] = useState('')
  const [audioCurrentTime, setAudioCurrentTime] = useState(0)
  const [audioDuration, setAudioDuration] = useState(0)
  const audioRef = useRef(null)
  const isAudioSeekingRef = useRef(false)
  const resumeTimeRef = useRef(0)
  const shouldResumePlaybackRef = useRef(false)
  const saveAudioProgressTimerRef = useRef(null)
  const lastSavedAudioTimeRef = useRef(null)

  const saveAudioProgress = useCallback(
    (rawTime, { force = false } = {}) => {
      if (!track?.bookId || !getAuthToken()) return
      const timecodeSeconds = Math.max(0, Math.floor(Number(rawTime) || 0))
      if (!force && Math.abs(timecodeSeconds - Number(lastSavedAudioTimeRef.current ?? -1)) < 5) return

      lastSavedAudioTimeRef.current = timecodeSeconds
      upsertReadingProgress({
        bookId: Number(track.bookId),
        lastPage: null,
        timecodeSeconds,
      }).catch(() => {})
    },
    [track?.bookId],
  )

  useEffect(() => {
    const saved = loadGlobalAudioPlayerState()
    if (!saved?.track) return

    const restoredTrack = normalizeTrack(saved.track)
    if (!restoredTrack) {
      clearGlobalAudioPlayerState()
      return
    }

    resumeTimeRef.current = Number(saved.currentTime) || 0
    shouldResumePlaybackRef.current = Boolean(saved.isPlaying)
    setVolume(Number.isFinite(saved.volume) ? Number(saved.volume) : 0.8)
    setTrack(restoredTrack)
    setPlayerOpen(true)
  }, [])

  useEffect(() => {
    const onOpenRequested = (event) => {
      const nextTrack = normalizeTrack(event.detail)
      if (!nextTrack) return

      const sameBook = Number(track?.bookId) === Number(nextTrack.bookId)

      if (sameBook && audioBlobUrl && audioRef.current) {
        setPlayerOpen(true)
        shouldResumePlaybackRef.current = true
        audioRef.current.play().catch(() => {
          window.alert('Не удалось продолжить воспроизведение аудио.')
        })
        return
      }

      resumeTimeRef.current = 0
      lastSavedAudioTimeRef.current = null
      shouldResumePlaybackRef.current = true
      setAudioCurrentTime(0)
      setAudioDuration(0)
      setTrack(nextTrack)
      setPlayerOpen(true)
    }

    window.addEventListener(AUDIO_PLAYER_OPEN_EVENT, onOpenRequested)
    return () => window.removeEventListener(AUDIO_PLAYER_OPEN_EVENT, onOpenRequested)
  }, [audioBlobUrl, track?.bookId])

  useEffect(() => {
    if (!audioRef.current) return
    audioRef.current.volume = volume
  }, [volume, playerOpen, audioBlobUrl])

  useEffect(() => {
    if (!playerOpen || !track?.bookId) return undefined

    let cancelled = false
    let objectUrl = ''

    setAudioBlobUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return ''
    })
    setAudioLoadError('')

    const loadAudio = async () => {
      setAudioLoading(true)
      try {
        const token = getAuthToken()
        if (!token) {
          throw new Error('Войдите в аккаунт, чтобы слушать аудиокнигу.')
        }

        const progress = await fetchReadingProgressByBook(track.bookId).catch(() => null)
        const savedTime = Number(progress?.timecodeSeconds ?? progress?.TimecodeSeconds)
        if (!cancelled && Number.isFinite(savedTime) && savedTime > 0 && resumeTimeRef.current <= 0) {
          resumeTimeRef.current = savedTime
        }

        const res = await fetch(listenAudioUrl(track.bookId), {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        })

        if (res.status === 401) {
          throw new Error('Сессия истекла. Войдите снова, чтобы продолжить прослушивание.')
        }
        if (res.status === 404) {
          throw new Error('Аудиофайл для этой книги не найден.')
        }
        if (!res.ok) {
          const text = await res.text().catch(() => '')
          throw new Error(text || `Ошибка загрузки аудио: ${res.status}`)
        }

        const blob = await res.blob()
        objectUrl = URL.createObjectURL(blob)

        if (cancelled) {
          URL.revokeObjectURL(objectUrl)
          return
        }

        setAudioBlobUrl(objectUrl)
      } catch (error) {
        if (!cancelled) {
          setAudioLoadError(error?.message || 'Не удалось загрузить аудиокнигу.')
          shouldResumePlaybackRef.current = false
        }
      } finally {
        if (!cancelled) setAudioLoading(false)
      }
    }

    loadAudio()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [playerOpen, track?.bookId])

  useEffect(() => {
    if (!playerOpen || !track) {
      clearGlobalAudioPlayerState()
      return
    }

    saveGlobalAudioPlayerState({
      track,
      volume,
      currentTime: audioCurrentTime,
      isPlaying,
    })
  }, [audioCurrentTime, isPlaying, playerOpen, track, volume])

  useEffect(() => {
    if (!playerOpen || !track?.bookId || !Number.isFinite(audioCurrentTime)) return undefined

    window.clearTimeout(saveAudioProgressTimerRef.current)
    saveAudioProgressTimerRef.current = window.setTimeout(() => {
      saveAudioProgress(audioCurrentTime)
    }, 1200)

    return () => {
      window.clearTimeout(saveAudioProgressTimerRef.current)
    }
  }, [audioCurrentTime, playerOpen, saveAudioProgress, track?.bookId])

  useEffect(
    () => () => {
      const currentTime = audioRef.current?.currentTime
      if (Number.isFinite(currentTime)) saveAudioProgress(currentTime, { force: true })
      window.clearTimeout(saveAudioProgressTimerRef.current)
    },
    [saveAudioProgress],
  )

  const closePlayer = () => {
    const currentTime = audioRef.current?.currentTime
    if (Number.isFinite(currentTime)) saveAudioProgress(currentTime, { force: true })
    window.clearTimeout(saveAudioProgressTimerRef.current)
    isAudioSeekingRef.current = false
    shouldResumePlaybackRef.current = false
    resumeTimeRef.current = 0

    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.removeAttribute('src')
      audioRef.current.load()
    }

    setAudioBlobUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return ''
    })
    setAudioLoadError('')
    setAudioLoading(false)
    setAudioCurrentTime(0)
    setAudioDuration(0)
    setTrack(null)
    setPlayerOpen(false)
    setIsPlaying(false)
    clearGlobalAudioPlayerState()
  }

  const togglePlayback = async () => {
    if (!audioRef.current || !audioBlobUrl) return

    if (isPlaying) {
      audioRef.current.pause()
      return
    }

    try {
      await audioRef.current.play()
    } catch {
      window.alert('Не удалось запустить аудио. Проверьте доступ к книге и повторите.')
    }
  }

  const handleAudioSeek = (value) => {
    const el = audioRef.current
    if (!el || !Number.isFinite(audioDuration) || audioDuration <= 0) return

    const nextTime = Math.min(Math.max(0, value), audioDuration)
    el.currentTime = nextTime
    setAudioCurrentTime(nextTime)
  }

  const seekProgress =
    Number.isFinite(audioDuration) && audioDuration > 0
      ? `${Math.min(Math.max(0, (audioCurrentTime / audioDuration) * 100), 100)}%`
      : '0%'

  if (!playerOpen || !track) return null

  return (
    <div className="audio-player" role="region" aria-label="Аудиоплеер">
      <div className="audio-player__row">
        <div className="audio-player__left">
          <div className="audio-player__cover-wrap">
            <img className="audio-player__cover" src={track.cover} alt="" />
          </div>
          <div className="audio-player__meta">
            <div className="audio-player__eyebrow">Сейчас играет</div>
            <div className="audio-player__title">{track.title}</div>
            <div className="audio-player__author">{track.author}</div>
          </div>
        </div>
        <div className="audio-player__controls">
          {audioLoading ? <span className="audio-player__status">Загрузка аудио...</span> : null}
          {audioLoadError ? <span className="audio-player__error">{audioLoadError}</span> : null}
          <button
            type="button"
            className={`audio-player__play${isPlaying ? ' audio-player__play--paused' : ''}`}
            onClick={togglePlayback}
            disabled={Boolean(audioLoading) || Boolean(audioLoadError) || !audioBlobUrl}
            aria-label={isPlaying ? 'Пауза' : 'Воспроизведение'}
          >
            <span className="audio-player__play-icon" aria-hidden="true">
              {isPlaying ? '||' : '>'}
            </span>
          </button>
          <label className="audio-player__volume">
            <span className="audio-player__volume-label">Громкость</span>
            <input
              type="range"
              className="audio-player__volume-input"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(event) => setVolume(Number(event.target.value))}
            />
          </label>
        </div>
        <button type="button" className="audio-player__close" onClick={closePlayer} aria-label="Закрыть плеер">
          x
        </button>
      </div>
      <div className="audio-player__seek">
        <span className="audio-player__time">{formatAudioTime(audioCurrentTime)}</span>
        <div className="audio-player__seek-bar" style={{ '--seek-progress': seekProgress }}>
          <input
            type="range"
            className="audio-player__seek-input"
            min={0}
            max={Number.isFinite(audioDuration) && audioDuration > 0 ? audioDuration : 0}
            step="any"
            value={
              Number.isFinite(audioDuration) && audioDuration > 0
                ? Math.min(Math.max(0, audioCurrentTime), audioDuration)
                : 0
            }
            disabled={
              Boolean(audioLoading) ||
              Boolean(audioLoadError) ||
              !audioBlobUrl ||
              !Number.isFinite(audioDuration) ||
              audioDuration <= 0
            }
            aria-label="Позиция воспроизведения"
            onPointerDown={() => {
              isAudioSeekingRef.current = true
            }}
            onPointerUp={() => {
              isAudioSeekingRef.current = false
            }}
            onPointerCancel={() => {
              isAudioSeekingRef.current = false
            }}
            onChange={(event) => handleAudioSeek(Number(event.target.value))}
          />
        </div>
        <span className="audio-player__time">{formatAudioTime(audioDuration)}</span>
      </div>
      <audio
        ref={audioRef}
        src={audioBlobUrl || undefined}
        onLoadedMetadata={() => {
          const el = audioRef.current
          if (!el) return

          const duration = el.duration
          const initialTime = Number.isFinite(resumeTimeRef.current) ? resumeTimeRef.current : 0

          if (Number.isFinite(duration) && duration > 0) {
            setAudioDuration(duration)
          } else {
            setAudioDuration(0)
          }

          if (initialTime > 0) {
            el.currentTime = Math.min(initialTime, Number.isFinite(duration) && duration > 0 ? duration : initialTime)
            setAudioCurrentTime(el.currentTime)
            resumeTimeRef.current = 0
          } else {
            setAudioCurrentTime(Number.isFinite(el.currentTime) ? el.currentTime : 0)
          }

          if (shouldResumePlaybackRef.current) {
            shouldResumePlaybackRef.current = false
            el.play().catch(() => {
              window.alert('Не удалось запустить аудио. Повторите попытку.')
            })
          }
        }}
        onDurationChange={() => {
          const el = audioRef.current
          if (!el) return
          const duration = el.duration
          if (Number.isFinite(duration) && duration > 0) setAudioDuration(duration)
        }}
        onTimeUpdate={() => {
          const el = audioRef.current
          if (!el || isAudioSeekingRef.current) return
          setAudioCurrentTime(el.currentTime)
        }}
        onSeeked={() => {
          const el = audioRef.current
          if (el) {
            setAudioCurrentTime(el.currentTime)
            saveAudioProgress(el.currentTime, { force: true })
          }
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => {
          setIsPlaying(false)
          const el = audioRef.current
          if (el) saveAudioProgress(el.currentTime, { force: true })
        }}
        onEnded={() => {
          setIsPlaying(false)
          const el = audioRef.current
          if (el && Number.isFinite(el.duration) && el.duration > 0) {
            setAudioCurrentTime(el.duration)
            saveAudioProgress(el.duration, { force: true })
          }
        }}
        preload="metadata"
      />
    </div>
  )
}
