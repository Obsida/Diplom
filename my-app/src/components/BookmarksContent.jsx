import { useState } from 'react'
import BookCard from './BookCard'

const BookmarksContent = ({
  loading,
  error,
  books,
  bookmarkedBookIds,
  cartBookIds,
  ownedBookIds,
  onSelectBook,
  onAddToCart,
  onBack,
}) => {
  const [bookmarkFilter, setBookmarkFilter] = useState('') // '' | 'Читаю' | 'Прочитано' | 'Позже' | 'Любимое'

  const filteredBooks = books.filter((book) => {
    if (!bookmarkFilter) return true
    return book.bookmarkCategory === bookmarkFilter
  })

  return (
    <>
      <div className="section-header">
        <div>
          <div className="section-header__title">Закладки</div>
          <div className="section-header__sub">
            {loading ? 'Загрузка…' : `${filteredBooks.length} книг`}
          </div>
        </div>
        <div className="section-header__filters" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select
            className="catalog-field__input"
            value={bookmarkFilter}
            onChange={(e) => setBookmarkFilter(e.target.value)}
            style={{ width: '180px', height: '38px', padding: '0 8px', borderRadius: '8px' }}
          >
            <option value="">Все закладки</option>
            <option value="Читаю">Читаю</option>
            <option value="Прочитано">Прочитано</option>
            <option value="Позже">Позже</option>
            <option value="Любимое">Любимое</option>
          </select>
          <button type="button" className="btn btn--light" onClick={onBack}>В каталог</button>
        </div>
      </div>

      {error ? (
        <div className="catalog-error" role="alert">
          {error}
          <p className="catalog-error__sub">Проверьте, что API запущен и авторизация активна.</p>
        </div>
      ) : null}

      {loading ? (
        <div className="catalog-loading">Загрузка закладок…</div>
      ) : filteredBooks.length === 0 ? (
        <div className="books-empty">
          <div className="books-empty__icon">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ display: 'inline-block' }}
            >
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          {bookmarkFilter ? 'Нет закладок в выбранной категории.' : 'Пока пусто. Добавьте книги в закладки из карточки книги.'}
        </div>
      ) : (
        <div className="books-grid">
          {filteredBooks.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              onClick={onSelectBook}
              isBookmarked={bookmarkedBookIds?.includes(book.bookId)}
              onAddToCart={onAddToCart}
              isInCart={cartBookIds?.includes(book.bookId)}
              isOwned={ownedBookIds?.includes(book.bookId)}
            />
          ))}
        </div>
      )}
    </>
  )
}

export default BookmarksContent

