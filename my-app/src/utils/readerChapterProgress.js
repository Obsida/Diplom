const key = (bookId) => `bookstore_reader_chapters_${bookId}`

function clamp01(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return 0
  return Math.min(1, Math.max(0, x))
}

/**
 * Прогресс чтения по книге: у каждой главы (индекс в массиве) свой слот { r, at }.
 * lastIndex — последняя открытая глава.
 * @returns {{ lastIndex: number, slots: Record<string, { r: number, at: string }> }}
 */
export function loadReaderChapterProgress(bookId) {
  if (!bookId) return { lastIndex: 0, slots: {} }
  try {
    const raw = window.localStorage.getItem(key(bookId))
    if (!raw) return { lastIndex: 0, slots: {} }
    const o = JSON.parse(raw)
    if (!o || typeof o !== 'object') return { lastIndex: 0, slots: {} }
    const slots = typeof o.slots === 'object' && o.slots !== null ? o.slots : {}
    const lastIndex = Number.isFinite(Number(o.lastIndex)) ? Number(o.lastIndex) : 0
    return { lastIndex, slots }
  } catch {
    return { lastIndex: 0, slots: {} }
  }
}

/**
 * @param {boolean} [updateLastIndex=true] — при смене главы слот сохраняют с false, затем вызывают setReaderLastChapterIndex.
 */
export function saveReaderChapterProgress(bookId, chapterIndex, scrollRatio, updateLastIndex = true) {
  if (!bookId) return
  const cur = loadReaderChapterProgress(bookId)
  const r = clamp01(scrollRatio)
  cur.slots[String(chapterIndex)] = { r, at: new Date().toISOString() }
  if (updateLastIndex) cur.lastIndex = chapterIndex
  try {
    window.localStorage.setItem(key(bookId), JSON.stringify(cur))
  } catch {
    /* ignore */
  }
}

export function setReaderLastChapterIndex(bookId, chapterIndex) {
  if (!bookId) return
  const cur = loadReaderChapterProgress(bookId)
  cur.lastIndex = chapterIndex
  try {
    window.localStorage.setItem(key(bookId), JSON.stringify(cur))
  } catch {
    /* ignore */
  }
}

export function getChapterScrollRatio(bookId, chapterIndex) {
  const slot = loadReaderChapterProgress(bookId).slots[String(chapterIndex)]
  return slot && Number.isFinite(slot.r) ? clamp01(slot.r) : 0
}

/** Снимок слотов прогресса по индексам глав (для списка «таймкод по каждой главе»). */
export function getAllChapterProgressSlots(bookId) {
  return { ...loadReaderChapterProgress(bookId).slots }
}

/** С сервера: LastPage = индекс последней открытой главы (0-based), слоты прокрутки по главам не трогаем. */
export function applyLastChapterFromServer(bookId, lastChapterIndex) {
  if (!bookId || lastChapterIndex == null) return
  const n = Number(lastChapterIndex)
  if (!Number.isFinite(n) || n < 0) return
  const cur = loadReaderChapterProgress(bookId)
  cur.lastIndex = Math.floor(n)
  try {
    window.localStorage.setItem(key(bookId), JSON.stringify(cur))
  } catch {
    /* ignore */
  }
}
