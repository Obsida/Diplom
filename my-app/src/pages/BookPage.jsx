import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  addBookmark,
  clearAuthToken,
  consumeOAuthResultFromUrl,
  createReview,
  deleteReview,
  deleteModerationReview,
  downloadAudioUrl,
  downloadPdfUrl,
  fetchBookDetail,
  fetchMyBookmarks,
  fetchMySubscriptions,
  fetchReviewsByBook,
  getAuthToken,
  isAdminToken,
  isManagerToken,
  removeBookmark,
  saveAuthToken,
  updateReview,
  coverUrl,
  buyBook,
  fetchMyLibrary,
  createPhysicalOrder,
} from '../api'
import '../App.css'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import AuthModal from '../components/AuthModal'
import SubscriptionModal from '../components/SubscriptionModal'
import CheckoutModal from '../components/CheckoutModal'
import StarRating from '../components/StarRating'
import { requestOpenGlobalAudioPlayer } from '../utils/globalAudioPlayer'
import { useModalBackdropClose } from '../utils/useModalBackdropClose'
import shareIcon from '../img/share.png'
import downloadIcon from '../img/download.png'
import { IconBookmark } from '../components/icons/MenuIcons'

function getBookIdFromPath() {
  const parts = window.location.pathname.split('/').filter(Boolean)
  const raw = parts[1]
  const id = Number(raw)
  return Number.isNaN(id) ? null : id
}

const tabs = ['Характеристики', 'Синопсис']

const REVIEW_SUBSCRIPTION_ONLY = 'Оставить отзыв можно только при активной подписке.'
const JWT_NAME_ID_CLAIM = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'

function normalizeReviewClientError(raw, fallback) {
  const msg = String(raw || '').trim()
  if (!msg) return fallback
  if (/библиотек/i.test(msg)) return REVIEW_SUBSCRIPTION_ONLY
  return msg
}

function getReviewItemUserId(item) {
  const value = item?.userId ?? item?.UserId
  if (value === undefined || value === null || value === '') return null

  const userId = Number(value)
  return Number.isNaN(userId) ? null : userId
}

function getFileNameFromDisposition(disposition, fallbackName) {
  const raw = String(disposition || '')
  const utfMatch = raw.match(/filename\*=UTF-8''([^;]+)/i)
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1])
    } catch {
      return utfMatch[1]
    }
  }

  const plainMatch = raw.match(/filename="?([^"]+)"?/i)
  return plainMatch?.[1] || fallbackName
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  textarea.remove()
}

function triggerBlobDownload(blob, fileName) {
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
}

export default function BookPage() {
  const bookId = getBookIdFromPath()
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [bookmarkId, setBookmarkId] = useState(null)
  const [bookmarkCategory, setBookmarkCategory] = useState('')
  const [bookmarkLoading, setBookmarkLoading] = useState(false)
  const [hasSubscriptionAccess, setHasSubscriptionAccess] = useState(false)
  const [isPurchased, setIsPurchased] = useState(false)
  const [buyingElectronic, setBuyingElectronic] = useState(false)
  const [inCartPhysical, setInCartPhysical] = useState(false)
  const [inCartElectronic, setInCartElectronic] = useState(false)
  const [buyMenuOpen, setBuyMenuOpen] = useState(false)
  const buyMenuRef = useRef(null)
  const [bookmarkMenuOpen, setBookmarkMenuOpen] = useState(false)
  const bookmarkMenuRef = useRef(null)
  const [tab, setTab] = useState('Характеристики')
  const [authToken, setAuthToken] = useState(() => getAuthToken())
  const [authOpen, setAuthOpen] = useState(false)
  const [subscriptionOpen, setSubscriptionOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [reviews, setReviews] = useState([])
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewText, setReviewText] = useState('')
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewError, setReviewError] = useState('')
  const [isEditingReview, setIsEditingReview] = useState(false)
  const [moderationDeletingReviewId, setModerationDeletingReviewId] = useState(null)
  const [pendingModerationDeleteReview, setPendingModerationDeleteReview] = useState(null)
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false)
  const downloadMenuRef = useRef(null)
  const moderationConfirmBackdropClose = useModalBackdropClose(() => {
    if (!moderationDeletingReviewId) setPendingModerationDeleteReview(null)
  })

  const isAdmin = isAdminToken(authToken)
  const isManager = isManagerToken(authToken)

  useEffect(() => {
    if (isAdmin && window.location.pathname.toLowerCase() !== '/admin') {
      window.location.replace('/admin')
    }
    if (isManager && window.location.pathname.toLowerCase() !== '/manager') {
      window.location.replace('/manager')
    }
  }, [isAdmin, isManager])

  useEffect(() => {
    if (!toastMessage) return undefined
    const timer = window.setTimeout(() => setToastMessage(''), 3200)
    return () => window.clearTimeout(timer)
  }, [toastMessage])

  useEffect(() => {
    if (!downloadMenuOpen) return undefined

    const handleClickOutside = (event) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(event.target)) {
        setDownloadMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [downloadMenuOpen])

  useEffect(() => {
    if (!buyMenuOpen) return undefined

    const handleClickOutside = (event) => {
      if (buyMenuRef.current && !buyMenuRef.current.contains(event.target)) {
        setBuyMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [buyMenuOpen])

  useEffect(() => {
    if (!bookmarkMenuOpen) return undefined

    const handleClickOutside = (event) => {
      if (bookmarkMenuRef.current && !bookmarkMenuRef.current.contains(event.target)) {
        setBookmarkMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [bookmarkMenuOpen])

  useEffect(() => {
    if (!pendingModerationDeleteReview) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setPendingModerationDeleteReview(null)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [pendingModerationDeleteReview])

  useEffect(() => {
    const originalAlert = window.alert
    window.alert = (message) => {
      setToastMessage(String(message ?? ''))
    }

    return () => {
      window.alert = originalAlert
    }
  }, [])

  useEffect(() => {
    const { token, error: oauthError } = consumeOAuthResultFromUrl()
    if (token) {
      saveAuthToken(token)
      setAuthToken(token)
      setAuthOpen(false)
      setToastMessage('Вход через Яндекс выполнен успешно.')
      return
    }

    if (oauthError) {
      setAuthOpen(true)
      setToastMessage(oauthError)
    }
  }, [])

  useEffect(() => {
    if (!bookId) return
    let cancelled = false

    setLoading(true)
    setError('')

    fetchBookDetail(bookId)
      .then((data) => {
        if (!cancelled) setDetail(data)
      })
      .catch((fetchError) => {
        if (!cancelled) {
          setError(fetchError?.message || 'Не удалось загрузить книгу.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [bookId])

  useEffect(() => {
    if (!bookId) return
    let cancelled = false

    fetchReviewsByBook(bookId)
      .then((list) => {
        if (!cancelled) setReviews(Array.isArray(list) ? list : [])
      })
      .catch(() => {
        if (!cancelled) setReviews([])
      })

    return () => {
      cancelled = true
    }
  }, [bookId])

  useEffect(() => {
    if (!bookId || !authToken) return
    let cancelled = false

    Promise.all([fetchMyBookmarks(''), fetchMySubscriptions(), fetchMyLibrary()])
      .then(([bookmarks, subscriptions, library]) => {
        if (cancelled) return

        const foundBookmark = Array.isArray(bookmarks)
          ? bookmarks.find((item) => Number(item.bookId) === Number(bookId))
          : null

        const purchased = Array.isArray(library)
          ? library.some((item) => Number(item?.book?.bookId) === Number(bookId) && (item?.acquisitionType === 'purchase' || item?.AcquisitionType === 'purchase'))
          : false

        setBookmarkId(foundBookmark?.bookmarkId ?? null)
        setBookmarkCategory(foundBookmark?.bookmarkType ?? '')
        setHasSubscriptionAccess(hasActiveSubscription(subscriptions))
        setIsPurchased(purchased)
      })
      .catch(() => {
        if (!cancelled) {
          setBookmarkId(null)
          setBookmarkCategory('')
          setHasSubscriptionAccess(false)
          setIsPurchased(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [authToken, bookId])

  useEffect(() => {
    if (authToken) return
    setBookmarkId(null)
    setBookmarkCategory('')
    setHasSubscriptionAccess(false)
    setIsPurchased(false)
  }, [authToken])


  const onChangeBookmarkCategory = async (newCategory) => {
    if (!authToken || !bookId) {
      setAuthOpen(true)
      return
    }

    setBookmarkLoading(true)
    try {
      if (!newCategory) {
        if (bookmarkId != null) {
          await removeBookmark(bookmarkId)
          setBookmarkId(null)
          setBookmarkCategory('')
          setToastMessage('Удалено из категорий чтения.')
        }
      } else {
        const created = await addBookmark(bookId, newCategory)
        setBookmarkId(created?.bookmarkId ?? -1)
        setBookmarkCategory(newCategory)
        setToastMessage(`Книга добавлена в категорию "${newCategory}".`)
      }
    } catch (e) {
      alert(e?.message || 'Не удалось обновить категорию.')
    } finally {
      setBookmarkLoading(false)
    }
  }

  useEffect(() => {
    if (!bookId) return

    try {
      const raw = window.localStorage.getItem('bookstore_cart')
      const parsed = raw ? JSON.parse(raw) : []
      const list = Array.isArray(parsed) ? parsed : []
      setInCartPhysical(list.some((item) => Number(item.bookId) === Number(bookId) && !item.isElectronic))
      setInCartElectronic(list.some((item) => Number(item.bookId) === Number(bookId) && item.isElectronic))
    } catch {
      setInCartPhysical(false)
      setInCartElectronic(false)
    }
  }, [bookId])

  const viewBook = useMemo(() => {
    if (!detail || !bookId) return null

    return {
      bookId,
      title: detail.title ?? '',
      author: detail?.author?.fullName ?? '',
      priceValue: Number(detail.price),
      price: `${Number(detail.price || 0).toLocaleString('ru-RU')} ₽`,
      cover: coverUrl(bookId),
      category: detail.categoryName ?? '',
      hasPdf: Boolean(detail.hasPdf),
    }
  }, [bookId, detail])

  const reviewList = Array.isArray(reviews) ? reviews : []
  const currentUserId = getUserIdFromToken(authToken)
  const myReview =
    currentUserId == null
      ? undefined
      : reviewList.find((item) => getReviewItemUserId(item) === currentUserId)

  const canReadPdf = Boolean(detail?.hasPdf) && (hasSubscriptionAccess || isPurchased)
  const canPostNewReview = Boolean(authToken) && (hasSubscriptionAccess || isPurchased)
  const canListenAudio = Boolean(detail?.hasAudio) && (hasSubscriptionAccess || isPurchased)
  const canDownloadAudio = canListenAudio

  useEffect(() => {
    if (!myReview) {
      setIsEditingReview(false)
      return
    }

    if (!isEditingReview) return
    setReviewRating(Number(myReview.rating ?? myReview.Rating) || 5)
    setReviewText(myReview.reviewText ?? myReview.ReviewText ?? '')
  }, [isEditingReview, myReview])

  const beginEditMyReview = useCallback(() => {
    if (!myReview) return
    setReviewRating(Number(myReview.rating ?? myReview.Rating) || 5)
    setReviewText(myReview.reviewText ?? myReview.ReviewText ?? '')
    setIsEditingReview(true)
    setReviewError('')
  }, [myReview])

  const deleteMyReview = useCallback(async () => {
    const reviewId = myReview?.reviewId ?? myReview?.ReviewId
    if (!reviewId || !bookId) return

    setReviewLoading(true)
    setReviewError('')

    try {
      await deleteReview(reviewId)
      const freshReviews = await fetchReviewsByBook(bookId)
      setReviews(Array.isArray(freshReviews) ? freshReviews : [])
      const freshDetail = await fetchBookDetail(bookId)
      setDetail(freshDetail)
      setReviewText('')
      setReviewRating(5)
      setIsEditingReview(false)
    } catch (submitError) {
      setReviewError(normalizeReviewClientError(submitError?.message, 'Не удалось удалить отзыв.'))
    } finally {
      setReviewLoading(false)
    }
  }, [bookId, myReview?.reviewId, myReview?.ReviewId])

  const deleteReviewAsManager = useCallback(async (review) => {
    const reviewId = review?.reviewId ?? review?.ReviewId
    if (!reviewId || !bookId || !isManager) return

    setModerationDeletingReviewId(reviewId)
    setReviewError('')

    try {
      await deleteModerationReview(reviewId, 'Удалено со страницы книги')
      const freshReviews = await fetchReviewsByBook(bookId)
      setReviews(Array.isArray(freshReviews) ? freshReviews : [])
      const freshDetail = await fetchBookDetail(bookId)
      setDetail(freshDetail)
      setToastMessage('Отзыв удалён.')
      setPendingModerationDeleteReview(null)
    } catch (submitError) {
      setReviewError(normalizeReviewClientError(submitError?.message, 'Не удалось удалить отзыв.'))
    } finally {
      setModerationDeletingReviewId(null)
    }
  }, [bookId, isManager])

  const requestDeleteReviewAsManager = useCallback((review) => {
    if (!isManager) return
    setPendingModerationDeleteReview(review)
  }, [isManager])

  const onToggleBookmark = async () => {
    if (!authToken || !bookId) {
      setAuthOpen(true)
      return
    }

    setBookmarkLoading(true)
    try {
      if (bookmarkId != null) {
        await removeBookmark(bookmarkId)
        setBookmarkId(null)
        setToastMessage('Книга удалена из закладок.')
      } else {
        const created = await addBookmark(bookId, 'favorite')
        setBookmarkId(created?.bookmarkId ?? -1)
        setToastMessage('Книга добавлена в закладки.')
      }
    } finally {
      setBookmarkLoading(false)
    }
  }

  const onAddToCart = useCallback((isElectronic = false) => {
    if (!viewBook) return
    if (!authToken) {
      setAuthOpen(true)
      return
    }

    try {
      const raw = window.localStorage.getItem('bookstore_cart')
      const parsed = raw ? JSON.parse(raw) : []
      const list = Array.isArray(parsed) ? parsed : []

      if (list.some((item) => Number(item.bookId) === Number(viewBook.bookId) && Boolean(item.isElectronic) === isElectronic)) {
        if (isElectronic) setInCartElectronic(true)
        else setInCartPhysical(true)
        return
      }

      const newItem = { ...viewBook, isElectronic }
      window.localStorage.setItem('bookstore_cart', JSON.stringify([newItem, ...list]))
      if (isElectronic) {
        setInCartElectronic(true)
        setToastMessage('Электронная книга добавлена в корзину.')
      } else {
        setInCartPhysical(true)
        setToastMessage('Печатная книга добавлена в корзину.')
      }
    } catch {
      setToastMessage('Не удалось добавить книгу в корзину.')
    }
  }, [viewBook, authToken])

  const handleBuyElectronic = useCallback(() => {
    onAddToCart(true)
  }, [onAddToCart])

  const handleShare = async () => {
    if (!bookId) return

    try {
      const shareUrl = `${window.location.origin}/book/${bookId}`
      await copyTextToClipboard(shareUrl)
      setToastMessage('Ссылка на книгу скопирована в буфер обмена.')
    } catch {
      setToastMessage('Не удалось скопировать ссылку.')
    }
  }

  const downloadProtectedFile = useCallback(
    async ({ url, fallbackName, noAccessMessage }) => {
      if (!bookId) return

      if (!authToken) {
        setAuthOpen(true)
        return
      }

      try {
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${authToken}` },
          credentials: 'include',
        })

        if (res.status === 401) {
          setAuthOpen(true)
          throw new Error('Сессия истекла. Войдите снова.')
        }
        if (res.status === 403) {
          throw new Error(noAccessMessage)
        }
        if (res.status === 404) {
          throw new Error('Файл для этой книги не найден.')
        }
        if (!res.ok) {
          const text = await res.text().catch(() => '')
          throw new Error(text || `Ошибка скачивания: ${res.status}`)
        }

        const blob = await res.blob()
        const fileName = getFileNameFromDisposition(res.headers.get('content-disposition'), fallbackName)
        triggerBlobDownload(blob, fileName)
        setToastMessage(`Скачивание файла "${fileName}" началось.`)
      } catch (downloadError) {
        setToastMessage(downloadError?.message || 'Не удалось скачать файл.')
      }
    },
    [authToken, bookId],
  )

  const handleDownloadPdf = () => {
    setDownloadMenuOpen(false)
    if (!bookId) return
    if (!canReadPdf) {
      setToastMessage(authToken ? 'PDF доступен только по подписке.' : 'Войдите в аккаунт для скачивания PDF.')
      if (!authToken) setAuthOpen(true)
      return
    }

    downloadProtectedFile({
      url: downloadPdfUrl(bookId),
      fallbackName: `book_${bookId}.pdf`,
      noAccessMessage: 'У вас нет доступа к скачиванию PDF.',
    })
  }

  const handleDownloadAudio = () => {
    setDownloadMenuOpen(false)
    if (!bookId) return
    if (!canDownloadAudio) {
      setToastMessage(authToken ? 'Аудиоверсия доступна только по подписке.' : 'Войдите в аккаунт для скачивания аудио.')
      if (!authToken) setAuthOpen(true)
      return
    }

    downloadProtectedFile({
      url: downloadAudioUrl(bookId),
      fallbackName: `book_${bookId}.mp3`,
      noAccessMessage: 'У вас нет доступа к скачиванию аудиоверсии.',
    })
  }

  const handleOpenAudioPlayer = () => {
    if (!bookId) return

    if (!canListenAudio) {
      if (!authToken) {
        setAuthOpen(true)
        return
      }

      setToastMessage('Аудиоверсия доступна только по подписке.')
      return
    }

    requestOpenGlobalAudioPlayer({
      bookId,
      title: detail?.title || `Книга #${bookId}`,
      author: detail?.author?.fullName || '',
      cover: coverUrl(bookId),
    })
  }

  const renderTabBody = () => {
    if (!detail) return null

    if (tab === 'Характеристики') {
      return (
        <dl className="book-detail__specs">
          <div className="book-detail__spec">
            <dt>Жанр</dt>
            <dd>{detail.categoryName || '—'}</dd>
          </div>
          <div className="book-detail__spec">
            <dt>Поджанр</dt>
            <dd>{detail.subcategoryName || '—'}</dd>
          </div>
          <div className="book-detail__spec">
            <dt>Год издания</dt>
            <dd>{detail.publicationYear || '—'}</dd>
          </div>
          <div className="book-detail__spec">
            <dt>Издатель</dt>
            <dd>{detail.publisher || '—'}</dd>
          </div>
        </dl>
      )
    }

    return (
      <p className="book-detail__synopsis">{detail.synopsis || 'Синопсис пока не добавлен.'}</p>
    )
  }

  const renderReviewsSection = () => {
    if (!detail) return null

    const showReviewForm =
      (Boolean(authToken) && Boolean(myReview) && isEditingReview) ||
      (!myReview && canPostNewReview)
    const showOwnReviewBar = Boolean(authToken && myReview && !isEditingReview)

    return (
      <div className="book-detail__reviews">
        {showOwnReviewBar ? (
          <div className="book-page__review-own-actions">
            <span>Вы уже оставили отзыв.</span>
            <button type="button" className="btn btn--light" onClick={beginEditMyReview}>
              Редактировать
            </button>
            <button type="button" className="btn btn--light" disabled={reviewLoading} onClick={deleteMyReview}>
              Удалить
            </button>
          </div>
        ) : null}

        {showReviewForm ? (
          <form
            className="book-page__review-form"
            onSubmit={async (event) => {
              event.preventDefault()
              if (!bookId) return

              const existingId = myReview?.reviewId ?? myReview?.ReviewId
              if (existingId) {
                setReviewLoading(true)
                setReviewError('')
                try {
                  await updateReview(existingId, Number(reviewRating), reviewText.trim())
                  const freshReviews = await fetchReviewsByBook(bookId)
                  setReviews(Array.isArray(freshReviews) ? freshReviews : [])
                  const freshDetail = await fetchBookDetail(bookId)
                  setDetail(freshDetail)
                  setIsEditingReview(false)
                } catch (submitError) {
                  setReviewError(
                    normalizeReviewClientError(submitError?.message, 'Не удалось сохранить отзыв.'),
                  )
                } finally {
                  setReviewLoading(false)
                }
                return
              }

              if (!canPostNewReview) {
                setReviewError(REVIEW_SUBSCRIPTION_ONLY)
                return
              }

              setReviewLoading(true)
              setReviewError('')
              try {
                await createReview(bookId, Number(reviewRating), reviewText.trim())
                const freshReviews = await fetchReviewsByBook(bookId)
                setReviews(Array.isArray(freshReviews) ? freshReviews : [])
                const freshDetail = await fetchBookDetail(bookId)
                setDetail(freshDetail)
                setIsEditingReview(false)
                setReviewText('')
                setReviewRating(5)
              } catch (submitError) {
                setReviewError(
                  normalizeReviewClientError(submitError?.message, 'Не удалось отправить отзыв.'),
                )
              } finally {
                setReviewLoading(false)
              }
            }}
          >
            <div className="book-page__review-form-row">
              <label htmlFor="reviewRating">Оценка</label>
              <select id="reviewRating" value={reviewRating} onChange={(event) => setReviewRating(Number(event.target.value))}>
                {[5, 4, 3, 2, 1].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              className="book-page__review-textarea"
              placeholder="Напишите ваш отзыв..."
              value={reviewText}
              onChange={(event) => setReviewText(event.target.value)}
            />
            <div className="book-page__review-form-row">
              <button type="submit" className="btn btn--dark" disabled={reviewLoading}>
                {reviewLoading ? 'Сохраняем...' : myReview ? 'Сохранить изменения' : 'Оставить отзыв'}
              </button>
              {myReview ? (
                <button
                  type="button"
                  className="btn btn--light"
                  onClick={() => {
                    setIsEditingReview(false)
                    setReviewError('')
                  }}
                >
                  Отмена
                </button>
              ) : null}
            </div>
          </form>
        ) : null}

        {reviewError ? <p className="catalog-error">{reviewError}</p> : null}

        {!authToken ? (
          <p className="book-detail__reviews-hint">Войдите, чтобы оставить отзыв или изменить свой.</p>
        ) : !myReview && !canPostNewReview ? (
          <p className="book-detail__reviews-hint">{REVIEW_SUBSCRIPTION_ONLY}</p>
        ) : null}

        {reviewList.length === 0 ? <p className="book-detail__reviews-empty">Отзывов пока нет. Будьте первым!</p> : null}

        {reviewList.map((review) => {
          const reviewId = review.reviewId ?? review.ReviewId
          const reviewUserId = getReviewItemUserId(review)
          const reviewTextValue = review.reviewText ?? review.ReviewText
          const reviewAuthor = review.userName ?? review.UserName
          const rating = review.rating ?? review.Rating
          const createdAt = review.createdAt ?? review.CreatedAt
          const canDeleteAsManager = isManager && reviewUserId !== currentUserId

          return (
            <article key={reviewId || `${reviewAuthor}-${createdAt}`} className="book-detail__review-card">
              <header className="book-detail__review-card-head">
                <strong>{reviewAuthor || 'Пользователь'}</strong>
                <StarRating rating={Number(rating) || 0} />
              </header>
              <p className="book-detail__review-card-text">{reviewTextValue || 'Без текста'}</p>
              {canDeleteAsManager ? (
                <div className="book-detail__review-card-actions">
                  <button
                    type="button"
                    className="btn btn--light"
                    disabled={moderationDeletingReviewId === reviewId}
                    onClick={() => requestDeleteReviewAsManager(review)}
                  >
                    {moderationDeletingReviewId === reviewId ? 'Удаляем...' : 'Удалить отзыв'}
                  </button>
                </div>
              ) : null}
            </article>
          )
        })}
      </div>
    )
  }

  if (!bookId) {
    return (
      <main className="main">
        <div className="catalog-error">Некорректный id книги.</div>
      </main>
    )
  }

  return (
    <>
      <Navbar
        isAuthorized={Boolean(authToken)}
        isAdmin={isAdmin}
        onHomeClick={() => {
          window.location.href = '/'
        }}
        onAuthClick={() => setAuthOpen(true)}
        onSubscriptionClick={() => setSubscriptionOpen(true)}
        onCartClick={() => {
          if (!authToken) return setAuthOpen(true)
          window.location.href = '/cart'
        }}
        onPurchasesClick={() => {
          if (!authToken) return setAuthOpen(true)
          window.location.href = '/purchases'
        }}
        onLibraryClick={() => {
          if (!authToken) return setAuthOpen(true)
          window.location.href = '/library'
        }}
        onBookmarksClick={() => {
          if (!authToken) return setAuthOpen(true)
          window.location.href = '/bookmarks'
        }}
        onProfileClick={() => {
          if (!authToken) return setAuthOpen(true)
          window.location.href = '/profile'
        }}
        isManager={isManager}
        onManagerPanelClick={isManager ? () => {
          window.location.href = '/manager'
        } : undefined}
        onAdminPanelClick={() => {
          if (!isAdmin) return
          window.location.href = '/admin'
        }}
        onLogout={() => {
          clearAuthToken()
          setAuthToken('')
          window.location.href = '/'
        }}
      />

      <main className="main book-page-main">
        <div className="book-page-top">
          <a className="btn btn--light book-page-top__back" href="/">
            ← В каталог
          </a>
        </div>

        {loading ? <div className="catalog-loading">Загрузка...</div> : null}
        {error ? <div className="catalog-error">{error}</div> : null}

        {!loading && !error && detail ? (
          <>
            <article className="book-detail">
              <div className="book-detail__cover-wrap">
                <div className="book-detail__cover-frame">
                  <img className="book-detail__cover" src={coverUrl(bookId)} alt={detail.title} />
                </div>
              </div>

              <div className="book-detail__main">
                <header className="book-detail__header">
                  <h1 className="book-detail__title">{detail.title}</h1>
                  <p className="book-detail__author">{detail.author?.fullName || 'Автор не указан'}</p>
                  <div className="book-detail__rating">
                    <StarRating rating={detail.rating || 0} />
                    <span>
                      {Number(detail.rating || 0).toFixed(1)} · {reviewList.length} отзывов
                    </span>
                  </div>
                  <p className="book-detail__price">{Number(detail.price).toLocaleString('ru-RU')} ₽</p>
                </header>

                <div className="book-detail__tabs" role="tablist">
                  {tabs.map((tabName) => (
                    <button
                      key={tabName}
                      type="button"
                      role="tab"
                      aria-selected={tabName === tab}
                      onClick={() => setTab(tabName)}
                      className={`book-detail__tab${tabName === tab ? ' book-detail__tab--active' : ''}`}
                    >
                      {tabName}
                    </button>
                  ))}
                </div>

                <div className="book-detail__panel">{renderTabBody()}</div>

                <div className="book-detail__actions">
                {canReadPdf ? (
                  <a className="btn btn--read" href={`/readdPdf?bookId=${bookId}`}>
                    Читать
                  </a>
                ) : (
                  <button type="button" className="btn btn--read" disabled>
                    {authToken ? 'Оформите подписку для чтения' : 'Войдите для чтения'}
                  </button>
                )}

                {isPurchased && inCartPhysical ? (
                  <button type="button" className="btn btn--read" disabled>
                    Куплено (электронная) / В корзине (печатная)
                  </button>
                ) : (
                  <div className="book-detail__download-wrap" ref={buyMenuRef} style={{ position: 'relative', display: 'inline-block' }}>
                    <button
                      type="button"
                      className={`btn btn--audio ${buyMenuOpen ? 'btn--audio-active' : ''}`}
                      onClick={() => setBuyMenuOpen((prev) => !prev)}
                      style={{ height: '42px', padding: '0 20px', borderRadius: '8px' }}
                    >
                      Купить
                    </button>
                    {buyMenuOpen ? (
                      <div className="book-detail__download-menu" role="menu" style={{ right: 0, left: 'auto', bottom: '100%', top: 'auto', marginBottom: '8px' }}>
                        <button
                          type="button"
                          className="book-detail__download-item"
                          role="menuitem"
                          onClick={() => {
                            setBuyMenuOpen(false)
                            handleBuyElectronic()
                          }}
                          disabled={isPurchased || inCartElectronic}
                        >
                          {isPurchased ? 'Электронная (куплена)' : inCartElectronic ? 'Электронная (в корзине)' : 'Электронная версия'}
                        </button>
                        <button
                          type="button"
                          className="book-detail__download-item"
                          role="menuitem"
                          onClick={() => {
                            setBuyMenuOpen(false)
                            onAddToCart(false)
                          }}
                          disabled={inCartPhysical}
                        >
                          {inCartPhysical ? 'Печатная (в корзине)' : 'Печатная книга'}
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}

                <button type="button" className="btn btn--read" onClick={handleOpenAudioPlayer} disabled={!canListenAudio}>
                  {canListenAudio ? 'Слушать аудио' : 'Аудио по подписке'}
                </button>

                <div className="book-detail__icon-actions">
                  <button
                    type="button"
                    className="book-detail__icon-btn"
                    onClick={handleShare}
                    aria-label="Поделиться"
                    title="Поделиться"
                  >
                    <img className="book-detail__icon-image" src={shareIcon} alt="" aria-hidden="true" />
                  </button>

                  <div className="book-detail__download-wrap" ref={bookmarkMenuRef}>
                    <button
                      type="button"
                      className={`book-detail__icon-btn${bookmarkMenuOpen || bookmarkCategory ? ' book-detail__icon-btn--active' : ''}`}
                      onClick={() => setBookmarkMenuOpen((prev) => !prev)}
                      disabled={bookmarkLoading}
                      aria-label="В закладки"
                      aria-haspopup="menu"
                      aria-expanded={bookmarkMenuOpen}
                      title={bookmarkCategory ? `В закладках: ${bookmarkCategory}` : 'Категория чтения'}
                    >
                      <IconBookmark
                        fill={bookmarkCategory ? 'var(--color-accent)' : 'none'}
                        stroke={bookmarkCategory ? 'var(--color-accent)' : 'currentColor'}
                        style={{ width: '20px', height: '20px' }}
                      />
                    </button>

                    {bookmarkMenuOpen ? (
                      <div className="book-detail__download-menu" role="menu" style={{ right: 0, left: 'auto' }}>
                        {['Читаю', 'Прочитано', 'Позже'].map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            className="book-detail__download-item"
                            role="menuitem"
                            onClick={() => {
                              setBookmarkMenuOpen(false)
                              onChangeBookmarkCategory(cat)
                            }}
                            style={{ fontWeight: bookmarkCategory === cat ? 'bold' : 'normal' }}
                          >
                            {cat}
                          </button>
                        ))}
                        {bookmarkCategory ? (
                          <>
                            <div style={{ margin: '4px 0', borderTop: '1px solid var(--color-border)' }} />
                            <button
                              type="button"
                              className="book-detail__download-item"
                              role="menuitem"
                              onClick={() => {
                                setBookmarkMenuOpen(false)
                                onChangeBookmarkCategory('')
                              }}
                              style={{ color: 'var(--md-sys-color-error, #f44336)' }}
                            >
                              Удалить из закладок
                            </button>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="book-detail__download-wrap" ref={downloadMenuRef}>
                    <button
                      type="button"
                      className={`book-detail__icon-btn${downloadMenuOpen ? ' book-detail__icon-btn--active' : ''}`}
                      onClick={() => setDownloadMenuOpen((prev) => !prev)}
                      aria-label="Скачать"
                      aria-haspopup="menu"
                      aria-expanded={downloadMenuOpen}
                      title="Скачать"
                    >
                      <img className="book-detail__icon-image" src={downloadIcon} alt="" aria-hidden="true" />
                    </button>

                    {downloadMenuOpen ? (
                      <div className="book-detail__download-menu" role="menu">
                        <button
                          type="button"
                          className="book-detail__download-item"
                          role="menuitem"
                          onClick={handleDownloadPdf}
                          disabled={!detail?.hasPdf}
                        >
                          Скачать PDF
                        </button>
                        <button
                          type="button"
                          className="book-detail__download-item"
                          role="menuitem"
                          onClick={handleDownloadAudio}
                          disabled={!detail?.hasAudio}
                        >
                          Скачать аудио
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
                </div>
              </div>
            </article>

            <section className="book-detail__reviews-section" aria-labelledby="book-reviews-title">
              <h2 id="book-reviews-title" className="book-detail__reviews-title">
                Отзывы читателей
              </h2>
              {renderReviewsSection()}
            </section>
          </>
        ) : null}
      </main>

      <Footer />

      {pendingModerationDeleteReview ? (
        <div
          className="moderation-confirm"
          role="presentation"
          {...moderationConfirmBackdropClose}
        >
          <section
            className="moderation-confirm__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="moderation-delete-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="moderation-confirm__icon" aria-hidden="true">!</div>
            <div className="moderation-confirm__content">
              <p className="moderation-confirm__eyebrow">Действие модератора</p>
              <h2 id="moderation-delete-title">Удалить отзыв?</h2>
              <p>
                Отзыв будет удалён со страницы книги, а действие сохранится в истории модерации.
              </p>
              <div className="moderation-confirm__review">
                <strong>{pendingModerationDeleteReview.userName ?? pendingModerationDeleteReview.UserName ?? 'Пользователь'}</strong>
                <span>{pendingModerationDeleteReview.reviewText ?? pendingModerationDeleteReview.ReviewText ?? 'Без текста'}</span>
              </div>
            </div>
            <div className="moderation-confirm__actions">
              <button
                type="button"
                className="btn btn--light"
                disabled={Boolean(moderationDeletingReviewId)}
                onClick={() => setPendingModerationDeleteReview(null)}
              >
                Отмена
              </button>
              <button
                type="button"
                className="btn btn--dark"
                disabled={Boolean(moderationDeletingReviewId)}
                onClick={() => deleteReviewAsManager(pendingModerationDeleteReview)}
              >
                {moderationDeletingReviewId ? 'Удаляем...' : 'Удалить'}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {toastMessage ? <div className="app-toast">{toastMessage}</div> : null}

      {authOpen ? (
        <AuthModal
          onClose={() => setAuthOpen(false)}
          onAuthSuccess={(token) => setAuthToken(token)}
          promptText="Чтобы продолжить, войдите в аккаунт."
        />
      ) : null}

      {subscriptionOpen ? (
        <SubscriptionModal
          isAuthorized={Boolean(authToken)}
          onClose={() => setSubscriptionOpen(false)}
          onAuthRequired={() => {
            setSubscriptionOpen(false)
            setAuthOpen(true)
          }}
          onSubscriptionPurchased={() => {
            setHasSubscriptionAccess(true)
            setToastMessage('Подписка активирована. Книга теперь доступна для чтения и прослушивания.')
          }}
        />
      ) : null}


    </>
  )
}

function getUserIdFromToken(token) {
  if (!token) return null

  try {
    const payload = token.split('.')[1]
    if (!payload) return null

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=')
    const json = JSON.parse(window.atob(padded))
    const raw =
      json?.nameid ??
      json?.sub ??
      json?.userId ??
      json?.UserId ??
      json?.[JWT_NAME_ID_CLAIM]

    const userId = Number(raw)
    return Number.isNaN(userId) ? null : userId
  } catch {
    return null
  }
}

function hasActiveSubscription(list) {
  if (!Array.isArray(list)) return false

  const now = new Date()
  return list.some((item) => {
    if (item?.status && String(item.status).toLowerCase() !== 'success') return false
    if (!item?.endDate) return false

    const endDate = new Date(`${item.endDate}T23:59:59`)
    return !Number.isNaN(endDate.getTime()) && endDate >= now
  })
}
