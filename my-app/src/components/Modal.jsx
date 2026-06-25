import { useEffect, useState } from 'react'
import { addBookmark, fetchBookDetail, fetchMyBookmarks, removeBookmark } from '../api'
import { useModalBackdropClose } from '../utils/useModalBackdropClose'

const PLACEHOLDER_COVER = 'https://placehold.co/280x400/2f2f2f/bfa054?text=Book'

const Modal = ({ book, onClose, onStartReading, onAddToCart, isInCart, isAuthorized, onAuthRequired, onBookmarkChange }) => {
  const [tab, setTab] = useState('Описание')
  const [detail, setDetail] = useState(null)
  const [bookmarkId, setBookmarkId] = useState(null)
  const [bookmarkLoading, setBookmarkLoading] = useState(false)
  const [bookmarkError, setBookmarkError] = useState('')
  const backdropClose = useModalBackdropClose(onClose)
  const tabs = ['Описание', 'Детали', 'Автор']

  useEffect(() => {
    setDetail(null)
    let cancelled = false
    fetchBookDetail(book.bookId)
      .then(d => {
        if (!cancelled) setDetail(d)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [book.bookId])

  useEffect(() => {
    setBookmarkError('')
    setBookmarkId(null)
    if (!isAuthorized) return

    let cancelled = false
    setBookmarkLoading(true)
    fetchMyBookmarks('')
      .then(items => {
        if (cancelled) return
        const found = Array.isArray(items)
          ? items.find(x => Number(x.bookId) === Number(book.bookId))
          : null
        setBookmarkId(found?.bookmarkId ?? null)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setBookmarkLoading(false)
      })
    return () => { cancelled = true }
  }, [book.bookId, isAuthorized])

  const authorName = detail?.author?.fullName ?? book.author
  const synopsis = detail?.synopsis ?? book.description
  const reviewCount = detail?.reviews?.length ?? null
  const stats = [
    ['Год', book.year],
    book.pages != null ? ['Страницы', book.pages] : null,
    ['Рейтинг', book.rating?.toFixed ? book.rating.toFixed(1) : book.rating],
    reviewCount != null ? ['Отзывы', reviewCount] : null,
  ].filter(Boolean)

  const tabBody = () => {
    if (tab === 'Описание') return synopsis || 'Нет описания.'
    if (tab === 'Детали') {
      const lines = [
        detail?.categoryName && `Жанр: ${detail.categoryName}`,
        detail?.subcategoryName && `Поджанр: ${detail.subcategoryName}`,
        detail?.publisher && `Издательство: ${detail.publisher}`,
        detail?.stockQuantity != null && `В наличии: ${detail.stockQuantity}`,
        book.hasPdf && 'Есть PDF',
        book.hasAudio && 'Есть аудио',
      ].filter(Boolean)
      return lines.length ? lines.join('\n') : 'Нет дополнительных данных.'
    }
    if (tab === 'Автор') {
      const bio = detail?.author?.biography
      if (bio) return bio
      return `Об авторе: ${authorName}`
    }
    return ''
  }

  const onToggleBookmark = async () => {
    if (!isAuthorized) {
      onAuthRequired?.('Чтобы добавлять книги в закладки, войдите в аккаунт.')
      return
    }
    setBookmarkError('')
    setBookmarkLoading(true)
    try {
      if (bookmarkId != null) {
        await removeBookmark(bookmarkId)
        setBookmarkId(null)
        onBookmarkChange?.(book.bookId, false)
      } else {
        const created = await addBookmark(book.bookId, 'favorite')
        setBookmarkId(created?.bookmarkId ?? -1)
        onBookmarkChange?.(book.bookId, true)
      }
    } catch (e) {
      setBookmarkError(e.message || 'Не удалось обновить закладки.')
    } finally {
      setBookmarkLoading(false)
    }
  }

  return (
    <div className="modal-overlay" role="presentation" {...backdropClose}>
      <div className="modal modal--full" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal__top">
          <div className="modal__cover-col">
            <img
              className="modal__cover"
              src={book.cover}
              alt={book.title}
              onError={e => {
                e.currentTarget.onerror = null
                e.currentTarget.src = PLACEHOLDER_COVER
              }}
            />
          </div>
          <div className="modal__info">
            <div className="modal__info-top">
              <div>
                <h2 className="modal__title">{book.title}</h2>
                <p className="modal__author">Автор: {authorName}</p>
              </div>
              <button type="button" className="modal__close" onClick={onClose}>×</button>
            </div>
            <p className="modal__price">{book.price}</p>
            <div className="modal__stats">
              {stats.map(([label, val]) => (
                <div key={label} className="modal__stat">
                  <div className="modal__stat-val">{val}</div>
                  <div className="modal__stat-label">{label}</div>
                </div>
              ))}
            </div>
            <div className="modal__tabs">
              {tabs.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`modal__tab ${t === tab ? 'modal__tab--active' : 'modal__tab--inactive'}`}
                >
                  {t}
                </button>
              ))}
            </div>
            <p className="modal__description" style={{ whiteSpace: 'pre-line' }}>{tabBody()}</p>
          </div>
        </div>
        <div className="modal__actions">
          <button
            type="button"
            className={`btn btn--bookmark ${bookmarkId != null ? 'btn--bookmark-active' : ''}`}
            onClick={onToggleBookmark}
            disabled={bookmarkLoading}
          >
            {bookmarkLoading ? 'Обновление...' : bookmarkId != null ? 'В закладках' : 'В закладки'}
          </button>
          <button
            type="button"
            className="btn btn--read"
            onClick={() => onStartReading(book)}
            disabled={!book.hasPdf}
          >
            Начать чтение
          </button>
          <button type="button" className="btn btn--audio" onClick={() => onAddToCart?.(book)}>
            {isInCart ? 'В корзине' : 'Купить печатную'}
          </button>
        </div>
        {bookmarkError ? <p className="modal__bookmark-error">{bookmarkError}</p> : null}
      </div>
    </div>
  )
}

export default Modal
