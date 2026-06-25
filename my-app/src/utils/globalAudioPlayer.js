const AUDIO_PLAYER_STATE_KEY = 'bookstore_audio_player_state_v1'
export const AUDIO_PLAYER_OPEN_EVENT = 'bookstore:audio-player-open'

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined'
}

export function requestOpenGlobalAudioPlayer(track) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(AUDIO_PLAYER_OPEN_EVENT, { detail: track }))
}

export function loadGlobalAudioPlayerState() {
  if (!canUseStorage()) return null

  try {
    const raw = window.sessionStorage.getItem(AUDIO_PLAYER_STATE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function saveGlobalAudioPlayerState(state) {
  if (!canUseStorage()) return

  try {
    window.sessionStorage.setItem(AUDIO_PLAYER_STATE_KEY, JSON.stringify(state))
  } catch {
    // Ignore storage write failures.
  }
}

export function clearGlobalAudioPlayerState() {
  if (!canUseStorage()) return

  try {
    window.sessionStorage.removeItem(AUDIO_PLAYER_STATE_KEY)
  } catch {
    // Ignore storage cleanup failures.
  }
}
