import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  fetchBookDetail,
  fetchReadingProgressByBook,
  getAuthToken,
  readPdfUrl,
  upsertReadingProgress,
  addBookmark,
} from '../api'
import {
  applyLastChapterFromServer,
  getAllChapterProgressSlots,
  getChapterScrollRatio,
  loadReaderChapterProgress,
  saveReaderChapterProgress,
  setReaderLastChapterIndex,
} from '../utils/readerChapterProgress'
import {
  DEFAULT_READER_THEME_ID,
  READER_THEMES,
  findReaderTheme,
} from '../utils/readerThemes'
import { splitReaderChapters } from '../utils/splitReaderChapters'
import '../App.css'

const READER_PREFS_KEY = 'bookstore_reader_prefs'
const FONT_MIN = 14
const FONT_MAX = 36
const FONT_STEP = 2

function getBookIdFromQuery() {
  const params = new URLSearchParams(window.location.search)
  return params.get('bookId')
}

function loadReaderPrefs() {
  try {
    const cookies = Object.fromEntries(
      document.cookie.split(';').map((c) => {
        const [k, ...v] = c.trim().split('=')
        return [k, decodeURIComponent(v.join('='))]
      })
    )
    const raw = cookies[READER_PREFS_KEY]
    if (!raw) return null
    const o = JSON.parse(raw)
    if (typeof o.fontSize === 'number') {
      const theme = findReaderTheme(typeof o.themeId === 'string' ? o.themeId : DEFAULT_READER_THEME_ID)
      return {
        fontSize: Math.min(FONT_MAX, Math.max(FONT_MIN, o.fontSize)),
        themeId: theme.id,
      }
    }
  } catch {
    /* ignore */
  }
  return null
}

function saveReaderPrefs(prefs) {
  try {
    const TWO_WEEKS = 14 * 24 * 60 * 60
    const value = encodeURIComponent(JSON.stringify(prefs))
    document.cookie = `${READER_PREFS_KEY}=${value}; max-age=${TWO_WEEKS}; path=/; SameSite=Lax`
  } catch {
    /* ignore */
  }
}

function synopsisFromDetail(detail) {
  return String(detail?.synopsis ?? detail?.Synopsis ?? '').trim()
}

const ReadPdfPage = () => {
  const bookId = getBookIdFromQuery()
  const [detail, setDetail] = useState(null)
  const [metaLoading, setMetaLoading] = useState(true)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [error, setError] = useState('')
  const [readerText, setReaderText] = useState('')
  const [readerHint, setReaderHint] = useState('')

  const chapters = useMemo(() => splitReaderChapters(readerText), [readerText])
  const [chapterIndex, setChapterIndex] = useState(0)
  const scrollRef = useRef(null)

  const defaults = useMemo(
    () => ({ fontSize: 18, themeId: DEFAULT_READER_THEME_ID }),
    [],
  )

  // Читаем куки синхронно при инициализации — до любых эффектов
  const [fontSize, setFontSize] = useState(() => {
    const saved = loadReaderPrefs()
    return saved ? saved.fontSize : 18
  })
  const [themeId, setThemeId] = useState(() => {
    const saved = loadReaderPrefs()
    return saved ? saved.themeId : DEFAULT_READER_THEME_ID
  })

  const [progressTick, setProgressTick] = useState(0)
  const [progressReadyToPersist, setProgressReadyToPersist] = useState(false)
  const upsertProgressTimer = useRef(null)
  /** После goToChapter — показать новую главу с начала, без восстановления сохранённой прокрутки */
  const scrollChapterToTopRef = useRef(false)
  /** Пользователь явно сменил главу — не перезаписывать индекс ответом ReadingProgress, пришедшим позже */
  const chapterNavigatedByUserRef = useRef(false)

  // Сохраняем в куки при каждом изменении fontSize / themeId
  useEffect(() => {
    saveReaderPrefs({ fontSize, themeId })
  }, [fontSize, themeId])

  useEffect(() => {
    chapterNavigatedByUserRef.current = false
    setProgressReadyToPersist(false)
    setChapterIndex(0)
    window.clearTimeout(upsertProgressTimer.current)
  }, [bookId])

  /** После смены текста книги — восстановить последнюю открытую главу из localStorage (пока нет явной навигации) */
  useEffect(() => {
    if (!bookId || !chapters.length) return
    const { lastIndex } = loadReaderChapterProgress(bookId)
    const idx = lastIndex >= 0 && lastIndex < chapters.length ? lastIndex : 0
    setChapterIndex(idx)
    if (!getAuthToken()) setProgressReadyToPersist(true)
  }, [bookId, readerText, chapters.length])

  /** Загрузить прогресс по главам с API (ReadingProgress) и слить в localStorage */
  useEffect(() => {
    const loading = metaLoading || pdfLoading
    if (!bookId || !chapters.length || loading) return
    if (!getAuthToken()) {
      setProgressReadyToPersist(true)
      return
    }
    let cancelled = false
    fetchReadingProgressByBook(bookId)
      .then((p) => {
        if (cancelled || p == null || p.lastPage == null) return
        if (chapterNavigatedByUserRef.current) return
        const localProgress = loadReaderChapterProgress(bookId)
        const localHasProgress =
          localProgress.lastIndex > 0 || Object.keys(localProgress.slots || {}).length > 0
        const serverLastPage = Number(p.lastPage)
        if (localHasProgress && serverLastPage === 0 && localProgress.lastIndex > 0) {
          return
        }
        applyLastChapterFromServer(bookId, p.lastPage)
        const { lastIndex } = loadReaderChapterProgress(bookId)
        const idx = lastIndex >= 0 && lastIndex < chapters.length ? lastIndex : 0
        setChapterIndex(idx)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setProgressReadyToPersist(true)
      })
    return () => {
      cancelled = true
    }
  }, [bookId, chapters.length, metaLoading, pdfLoading, readerText])

  /** Синхронизация прогресса по главам на сервер (ReadingProgress_Upsert) */
  useEffect(() => {
    if (!bookId || !getAuthToken()) return undefined
    if (!progressReadyToPersist || !chapters.length || metaLoading || pdfLoading) return undefined
    window.clearTimeout(upsertProgressTimer.current)
    upsertProgressTimer.current = window.setTimeout(() => {
      upsertReadingProgress({
        bookId: Number(bookId),
        lastPage: chapterIndex,
        timecodeSeconds: null,
      }).catch(() => {})
    }, 900)
    return () => {
      window.clearTimeout(upsertProgressTimer.current)
    }
  }, [bookId, progressTick, chapterIndex, progressReadyToPersist, chapters.length, metaLoading, pdfLoading])

  const automaticallyMarkedAsReadRef = useRef(false)

  useEffect(() => {
    automaticallyMarkedAsReadRef.current = false
  }, [bookId])

  useEffect(() => {
    if (!bookId || !getAuthToken() || !chapters.length || metaLoading || pdfLoading) return
    if (chapterIndex === chapters.length - 1 && !automaticallyMarkedAsReadRef.current) {
      automaticallyMarkedAsReadRef.current = true
      addBookmark(Number(bookId), 'Прочитано').catch(() => {
        automaticallyMarkedAsReadRef.current = false
      })
    }
  }, [bookId, chapterIndex, chapters.length, metaLoading, pdfLoading])

  const flushScrollPosition = useCallback(() => {
    const el = scrollRef.current
    if (!el || !bookId) return
    const max = el.scrollHeight - el.clientHeight
    const r = max <= 0 ? 0 : el.scrollTop / max
    saveReaderChapterProgress(bookId, chapterIndex, r)
  }, [bookId, chapterIndex])

  const goToChapter = useCallback(
    (nextIndex) => {
      const el = scrollRef.current
      if (el && bookId) {
        const max = el.scrollHeight - el.clientHeight
        const r = max <= 0 ? 0 : el.scrollTop / max
        saveReaderChapterProgress(bookId, chapterIndex, r, false)
      }
      const n = chapters.length ? Math.min(chapters.length - 1, Math.max(0, nextIndex)) : 0
      if (n !== chapterIndex) {
        chapterNavigatedByUserRef.current = true
        scrollChapterToTopRef.current = true
      }
      setChapterIndex(n)
      if (bookId) setReaderLastChapterIndex(bookId, n)
    },
    [bookId, chapterIndex, chapters.length],
  )

  useLayoutEffect(() => {
    const el = scrollRef.current
    const ch = chapters[chapterIndex]
    if (!el || !ch) return
    if (scrollChapterToTopRef.current) {
      scrollChapterToTopRef.current = false
      const snapTop = () => {
        el.scrollTop = 0
      }
      snapTop()
      const id = requestAnimationFrame(snapTop)
      if (bookId) saveReaderChapterProgress(bookId, chapterIndex, 0, true)
      return () => cancelAnimationFrame(id)
    }
    const r = getChapterScrollRatio(bookId, chapterIndex)
    const apply = () => {
      const max = el.scrollHeight - el.clientHeight
      el.scrollTop = max <= 0 ? 0 : r * max
    }
    apply()
    const id = requestAnimationFrame(apply)
    return () => cancelAnimationFrame(id)
  }, [chapterIndex, chapters, bookId, fontSize, readerText])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let t
    const onScroll = () => {
      clearTimeout(t)
      t = window.setTimeout(() => {
        const max = el.scrollHeight - el.clientHeight
        const r = max <= 0 ? 0 : el.scrollTop / max
        saveReaderChapterProgress(bookId, chapterIndex, r)
        setProgressTick((x) => x + 1)
      }, 380)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      clearTimeout(t)
      el.removeEventListener('scroll', onScroll)
    }
  }, [bookId, chapterIndex])

  useEffect(
    () => () => {
      flushScrollPosition()
    },
    [flushScrollPosition],
  )

  useEffect(() => {
    if (!bookId) {
      setMetaLoading(false)
      return
    }

    let cancelled = false
    setMetaLoading(true)
    setPdfLoading(false)
    setError('')
    setReaderText('')
    setReaderHint('')

    const run = async () => {
      let loadedDetail = null
      try {
        loadedDetail = await fetchBookDetail(bookId)
        if (cancelled) return
        setDetail(loadedDetail)
      } catch (e) {
        if (cancelled) return
        const msg = String(e?.message || '')
        if (msg.includes('вход') || msg.includes('401')) {
          setError('Для чтения нужна авторизация. Выполните вход в аккаунт.')
        } else if (msg.includes('запрещ') || msg.includes('403')) {
          setError('Доступ к книге запрещён. Проверьте подписку или покупку.')
        } else if (msg.includes('не найден') || msg.includes('404')) {
          setError('Книга не найдена.')
        } else {
          setError(msg || 'Не удалось загрузить книгу.')
        }
        setMetaLoading(false)
        return
      }

      if (cancelled) return
      setMetaLoading(false)

      const synopsis = synopsisFromDetail(loadedDetail)
      const pdfExplicitlyMissing =
        loadedDetail?.hasPdf === false || loadedDetail?.hasPDF === false

      const applySynopsis = (hint) => {
        if (cancelled) return
        setReaderText(synopsis)
        setReaderHint(hint)
      }

      if (pdfExplicitlyMissing) {
        applySynopsis(synopsis ? '' : 'В каталоге для книги не указан PDF. Добавьте файл или синопсис.')
        return
      }

      setPdfLoading(true)
      try {
        const token = getAuthToken()
        const headers = token ? { Authorization: `Bearer ${token}` } : {}
        const res = await fetch(readPdfUrl(bookId), { headers, credentials: 'include' })

        if (res.status === 401) {
          setError('Для чтения PDF нужна авторизация. Выполните вход в аккаунт.')
          return
        }
        if (res.status === 403) {
          setError('Доступ к PDF запрещён. Проверьте подписку или покупку.')
          return
        }

        if (!res.ok) {
          applySynopsis(
            synopsis
              ? 'PDF недоступен (ошибка сервера). Показан синопсис.'
              : `Не удалось загрузить PDF (${res.status}).`,
          )
          return
        }

        const buf = await res.arrayBuffer()
        const { extractPdfText } = await import('../utils/extractPdfText.js')
        const extracted = await extractPdfText(buf)
        if (cancelled) return

        if (extracted) {
          setReaderText(extracted)
          setReaderHint('')
        } else {
          applySynopsis(
            synopsis
              ? 'Из PDF не удалось извлечь текст. Показан синопсис.'
              : 'Из PDF не удалось извлечь текст.',
          )
        }
      } catch {
        if (cancelled) return
        applySynopsis(
          synopsis
            ? 'Ошибка при разборе PDF. Показан синопсис.'
            : 'Не удалось прочитать PDF.',
        )
      } finally {
        if (!cancelled) setPdfLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [bookId])

  const title = detail?.title ?? `Книга #${bookId}`
  const author = detail?.author?.fullName ?? detail?.authorName ?? ''

  const bumpFont = useCallback((delta) => {
    setFontSize((s) => Math.min(FONT_MAX, Math.max(FONT_MIN, s + delta)))
  }, [])

  const selectedTheme = findReaderTheme(themeId)

  const resetAppearance = useCallback(() => {
    setFontSize(defaults.fontSize)
    setThemeId(defaults.themeId)
  }, [defaults])

  const goToBookPage = useCallback(
    async (event) => {
      event.preventDefault()
      if (!bookId) {
        window.location.href = '/'
        return
      }

      flushScrollPosition()
      setReaderLastChapterIndex(bookId, chapterIndex)

      if (getAuthToken() && progressReadyToPersist && chapters.length) {
        try {
          await upsertReadingProgress({
            bookId: Number(bookId),
            lastPage: chapterIndex,
            timecodeSeconds: null,
          })
        } catch {
          /* Local progress is already saved; ignore network errors on navigation. */
        }
      }

      window.location.href = `/book/${bookId}`
    },
    [bookId, chapterIndex, chapters.length, flushScrollPosition, progressReadyToPersist],
  )

  const loading = metaLoading || pdfLoading
  const statusMessage = metaLoading ? 'Загрузка книги…' : pdfLoading ? 'Извлечение текста из PDF…' : ''

  const currentChapter = chapters[chapterIndex]
  const totalChapters = chapters.length
  const chapterNavLabel = totalChapters > 1 ? `Глава ${chapterIndex + 1} из ${totalChapters}` : null

  const slotMeta = useMemo(() => {
    if (!bookId) return null
    const s = loadReaderChapterProgress(bookId).slots[String(chapterIndex)]
    if (!s?.at) return null
    try {
      const d = new Date(s.at)
      if (Number.isNaN(d.getTime())) return null
      return { atLabel: d.toLocaleString('ru-RU'), ratio: s.r }
    } catch {
      return null
    }
  }, [bookId, chapterIndex, progressTick, readerText])

  /** Отдельная метка прогресса (таймкод) для каждой главы */
  const progressByChapter = useMemo(() => {
    if (!bookId || !chapters.length) return []
    const slots = getAllChapterProgressSlots(bookId)
    return chapters.map((ch, i) => {
      const slot = slots[String(i)]
      let atLabel = ''
      if (slot?.at) {
        try {
          const d = new Date(slot.at)
          if (!Number.isNaN(d.getTime())) atLabel = d.toLocaleString('ru-RU')
        } catch {
          atLabel = ''
        }
      }
      return {
        index: i,
        title: ch.title,
        ratio: slot && Number.isFinite(slot.r) ? slot.r : null,
        atLabel,
      }
    })
  }, [bookId, chapters, progressTick, chapterIndex, readerText])

  if (!bookId) {
    return (
      <main className="reader-page reader-page--shell">
        <div className="reader-page__card">
          <h1 className="reader-page__heading">Чтение</h1>
          <p className="reader-page__muted">Не передан идентификатор книги.</p>
          <a className="reader-page__back" href="/">Вернуться в каталог</a>
        </div>
      </main>
    )
  }

  return (
    <main
      className="reader-page reader-page--shell"
      style={{ backgroundColor: selectedTheme.background, color: selectedTheme.text }}
    >
      <header className="reader-page__topbar">
        <div className="reader-page__topbar-main">
          <h1 className="reader-page__heading">{title}</h1>
          {author ? <p className="reader-page__author-line">{author}</p> : null}
        </div>
        <div className="reader-page__toolbar" aria-label="Настройки чтения">
          <div className="reader-page__tool-group">
            <span className="reader-page__tool-label">Размер</span>
            <button type="button" className="btn btn--light reader-page__icon-btn" onClick={() => bumpFont(-FONT_STEP)} disabled={fontSize <= FONT_MIN} aria-label="Уменьшить шрифт">A−</button>
            <span className="reader-page__font-value" aria-live="polite">{fontSize}px</span>
            <button type="button" className="btn btn--light reader-page__icon-btn" onClick={() => bumpFont(FONT_STEP)} disabled={fontSize >= FONT_MAX} aria-label="Увеличить шрифт">A+</button>
          </div>
          <div className="reader-page__tool-group">
            <label className="reader-page__theme-label">
              Тема
              <select
                className="reader-page__theme-select"
                value={selectedTheme.id}
                onChange={(e) => setThemeId(e.target.value)}
                aria-label="Тема чтения"
                style={{ backgroundColor: selectedTheme.background, color: selectedTheme.text }}
              >
                {READER_THEMES.map((theme) => (
                  <option key={theme.id} value={theme.id}>
                    {theme.name}
                  </option>
                ))}
              </select>
            </label>
            <span className="reader-page__theme-swatch" aria-hidden="true">
              <span style={{ backgroundColor: selectedTheme.background }} />
              <span style={{ backgroundColor: selectedTheme.text }} />
            </span>
          </div>
          <button type="button" className="btn btn--light reader-page__reset" onClick={resetAppearance}>
            Сброс
          </button>
          <a className="btn btn--dark reader-page__back-inline" href={`/book/${bookId}`} onClick={goToBookPage}>К странице книги</a>
        </div>
      </header>

      {loading ? <div className="reader-page__status">{statusMessage}</div> : null}
      {!loading && error ? <div className="reader-page__status reader-page__status--error" role="alert">{error}</div> : null}

      {!loading && !error && detail && currentChapter ? (
        <div className="reader-page__chapter-shell">
          {readerHint ? <p className="reader-page__hint reader-page__hint--sticky">{readerHint}</p> : null}

          <nav
            className={`reader-page__chapter-nav${totalChapters <= 1 ? ' reader-page__chapter-nav--single' : ''}`}
            aria-label={totalChapters > 1 ? 'Навигация по главам' : 'Прогресс чтения'}
          >
            {totalChapters > 1 ? (
              <>
                <button
                  type="button"
                  className="btn btn--light"
                  disabled={chapterIndex <= 0}
                  onClick={() => goToChapter(chapterIndex - 1)}
                >
                  ← Предыдущая глава
                </button>
                <div className="reader-page__chapter-center">
                  <label className="reader-page__chapter-select-label">
                    <span className="reader-page__chapter-page-label">{chapterNavLabel}</span>
                    <select
                      className="reader-page__chapter-select"
                      value={chapterIndex}
                      onChange={(e) => goToChapter(Number(e.target.value))}
                      style={{ backgroundColor: selectedTheme.background, color: selectedTheme.text }}
                    >
                      {chapters.map((ch, i) => (
                        <option key={ch.id} value={i}>
                          {`${i + 1}. ${ch.title}`.slice(0, 120)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <button
                  type="button"
                  className="btn btn--light"
                  disabled={chapterIndex >= totalChapters - 1}
                  onClick={() => goToChapter(chapterIndex + 1)}
                >
                  Следующая глава →
                </button>
              </>
            ) : (
              <span className="reader-page__chapter-single-note">В тексте нет строк «Глава …» — показан целиком.</span>
            )}
            <div className="reader-page__chapter-meta-row">
              {slotMeta ? (
                <span className="reader-page__chapter-meta">
                  Эта глава — {(slotMeta.ratio * 100).toFixed(0)}% · {slotMeta.atLabel}
                </span>
              ) : (
                <span className="reader-page__chapter-meta reader-page__chapter-meta--muted">
                  Для каждой главы сохраняется своя метка (доля прокрутки и время) при прокрутке
                </span>
              )}
            </div>
          </nav>

          {totalChapters > 1 && progressByChapter.length > 0 ? (
            <details className="reader-page__progress-all">
              <summary className="reader-page__progress-all-summary">
                Прогресс (таймкод) по всем главам
              </summary>
              <ul className="reader-page__progress-all-list">
                {progressByChapter.map((row) => (
                  <li key={row.index}>
                    <button
                      type="button"
                      className={`reader-page__progress-all-item${row.index === chapterIndex ? ' reader-page__progress-all-item--active' : ''}`}
                      onClick={() => goToChapter(row.index)}
                    >
                      <span className="reader-page__progress-all-num">{row.index + 1}.</span>
                      <span className="reader-page__progress-all-title">{row.title.slice(0, 90)}{row.title.length > 90 ? '…' : ''}</span>
                      <span className="reader-page__progress-all-slot">
                        {row.ratio != null
                          ? `${(row.ratio * 100).toFixed(0)}%${row.atLabel ? ` · ${row.atLabel}` : ''}`
                          : '—'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          <div ref={scrollRef} className="reader-page__chapter-pane">
            <article
              className="reader-page__article reader-page__article--in-pane"
              style={{
                color: selectedTheme.text,
                fontSize: `${fontSize}px`,
                lineHeight: 1.65,
              }}
            >
              <h2 className="reader-page__chapter-title">{currentChapter.title}</h2>
              {currentChapter.body ? (
                <div className="reader-page__body">
                  {currentChapter.body.split(/\r?\n/).map((para, i) => (
                    para.trim() ? <p key={i} className="reader-page__para">{para.trim()}</p> : <br key={i} />
                  ))}
                </div>
              ) : (
                <p className="reader-page__empty">В этой главе пока только заголовок.</p>
              )}
            </article>
          </div>

          {totalChapters > 1 ? (
            <nav
              className="reader-page__chapter-nav reader-page__chapter-nav--footer"
              aria-label="Предыдущая и следующая глава"
            >
              <button
                type="button"
                className="btn btn--light reader-page__chapter-footer-btn"
                disabled={chapterIndex <= 0}
                onClick={() => goToChapter(chapterIndex - 1)}
              >
                ← Предыдущая глава
              </button>
              <span className="reader-page__chapter-footer-center" title={currentChapter.title}>
                {chapterNavLabel}
              </span>
              <button
                type="button"
                className="btn btn--light reader-page__chapter-footer-btn"
                disabled={chapterIndex >= totalChapters - 1}
                onClick={() => goToChapter(chapterIndex + 1)}
              >
                Следующая глава →
              </button>
            </nav>
          ) : null}
        </div>
      ) : !loading && !error && detail ? (
        <p className="reader-page__status">Нет текста для отображения.</p>
      ) : null}
    </main>
  )
}

export default ReadPdfPage
