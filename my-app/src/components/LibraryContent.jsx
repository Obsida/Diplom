import { useState } from 'react'

const LibraryContinueSection = ({ items, onSelectBook, onContinueAudio }) => {
  if (!items?.length) return null

  return (
    <section className="library-continue" aria-labelledby="library-continue-title">
      <div className="library-continue__head">
        <div>
          <h2 id="library-continue-title">Продолжить</h2>
          <p>Последние книги, которые вы читали или слушали.</p>
        </div>
      </div>

      <div className="library-continue__list">
        {items.map((book) => (
          <article key={book.bookId} className="library-continue__item">
            <button
              type="button"
              className="library-continue__cover-btn"
              onClick={() => onSelectBook?.(book)}
              aria-label={`Открыть книгу ${book.title}`}
            >
              <img className="library-continue__cover" src={book.cover} alt="" />
            </button>

            <div className="library-continue__body">
              <div>
                <h3>{book.title || `Книга #${book.bookId}`}</h3>
                <p className="library-continue__author">{book.author || 'Автор не указан'}</p>
              </div>

              <div className="library-continue__meta">
                {book.readingChapterLabel ? <span>{book.readingChapterLabel}</span> : null}
                {book.audioTimeLabel ? <span>Аудио {book.audioTimeLabel}</span> : null}
                {book.updatedAtLabel ? <span>{book.updatedAtLabel}</span> : null}
              </div>

              <div className="library-continue__actions">
                {book.hasReadingProgress ? (
                  <a className="btn btn--dark" href={`/readdPdf?bookId=${book.bookId}`}>
                    Продолжить читать
                  </a>
                ) : null}
                {book.hasAudioProgress ? (
                  <button type="button" className="btn btn--light" onClick={() => onContinueAudio?.(book)}>
                    {book.hasReadingProgress ? 'Слушать' : 'Продолжить'}
                  </button>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

const LibraryBookList = ({
  books,
  bookmarkedBookIds,
  cartBookIds,
  ownedBookIds,
  onSelectBook,
  onAddToCart,
}) => (
  <div className="library-list" aria-label="Книги в личной библиотеке">
    {books.map((book) => {
      const isBookmarked = bookmarkedBookIds?.includes(book.bookId)
      const isInCart = cartBookIds?.includes(book.bookId)
      const isOwned = ownedBookIds?.includes(book.bookId)

      return (
        <article key={book.id} className="library-list__item">
          <button
            type="button"
            className="library-list__cover-btn"
            onClick={() => onSelectBook?.(book)}
            aria-label={`Открыть книгу ${book.title}`}
          >
            <img className="library-list__cover" src={book.cover} alt="" />
          </button>

          <div className="library-list__content">
            <div className="library-list__main">
              <div className="library-list__title-row">
                <h3>{book.title || `Книга #${book.bookId}`}</h3>
                {isBookmarked ? <span className="library-list__badge">В закладках</span> : null}
              </div>
              <p className="library-list__author">{book.author || 'Автор не указан'}</p>
              <div className="library-list__meta">
                {book.category ? <span>{book.category}</span> : null}
                {book.year ? <span>{book.year}</span> : null}
                {book.hasPdf ? <span>PDF</span> : null}
                {book.hasAudio ? <span>Аудио</span> : null}
              </div>
              {book.description ? (
                <p className="library-list__description">{book.description}</p>
              ) : null}
            </div>

            <div className="library-list__actions">
              <button type="button" className="btn btn--dark" onClick={() => onSelectBook?.(book)}>
                Открыть
              </button>
              <button
                type="button"
                className="btn btn--light"
                onClick={() => {
                  if (!isOwned && !isInCart) onAddToCart?.(book)
                }}
                disabled={isOwned || isInCart}
              >
                {isOwned ? 'В библиотеке' : isInCart ? 'В корзине' : 'Купить печатную'}
              </button>
            </div>
          </div>
        </article>
      )
    })}
  </div>
)

const LibraryContent = ({
  loading,
  error,
  books,
  continueItems,
  bookmarkedBookIds,
  cartBookIds,
  ownedBookIds,
  onSelectBook,
  onAddToCart,
  onContinueAudio,
  onBack,
  title = "Личная библиотека",
}) => {
  const [bookmarkFilter, setBookmarkFilter] = useState('') // '' | 'Читаю' | 'Прочитано' | 'Позже' | 'Любимое' | 'none'

  const filteredBooks = books.filter((book) => {
    if (!bookmarkFilter) return true
    if (bookmarkFilter === 'none') {
      return !book.bookmarkCategory
    }
    return book.bookmarkCategory === bookmarkFilter
  })

  return (
    <>
      <div className="section-header">
        <div>
          <div className="section-header__title">{title}</div>
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
            <option value="">Все книги</option>
            <option value="Читаю">Читаю</option>
            <option value="Прочитано">Прочитано</option>
            <option value="Позже">Позже</option>
            <option value="Любимое">Любимое</option>
            <option value="none">Без закладки</option>
          </select>
          <button type="button" className="btn btn--light" onClick={onBack}>В каталог</button>
        </div>
      </div>

      {error ? (
        <div className="catalog-error" role="alert">
          {error}
          <p className="catalog-error__sub">Проверьте, что API запущен и у пользователя есть купленные/добавленные книги.</p>
        </div>
      ) : null}

      {!loading && !error ? (
        <LibraryContinueSection
          items={continueItems}
          onSelectBook={onSelectBook}
          onContinueAudio={onContinueAudio}
        />
      ) : null}

      {loading ? (
        <div className="catalog-loading">Загрузка библиотеки…</div>
      ) : filteredBooks.length === 0 && !continueItems?.length ? (
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
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </div>
          {bookmarkFilter ? 'Нет книг в выбранной категории.' : 'Библиотека пока пустая. Добавьте книги в личную коллекцию.'}
        </div>
      ) : filteredBooks.length === 0 ? null : (
        <LibraryBookList
          books={filteredBooks}
          bookmarkedBookIds={bookmarkedBookIds}
          cartBookIds={cartBookIds}
          ownedBookIds={ownedBookIds}
          onSelectBook={onSelectBook}
          onAddToCart={onAddToCart}
        />
      )}
    </>
  )
}

export default LibraryContent
