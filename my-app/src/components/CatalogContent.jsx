import BookCard from './BookCard'
import Pagination from './Pagination'

const CatalogContent = ({
  error,
  loading,
  books,
  bookmarkedBookIds,
  currentPage,
  totalPages,
  totalCount,
  onSelectBook,
  onPageChange,
  onAddToCart,
  cartBookIds,
  ownedBookIds,
}) => {
  const hasBooks = books && books.length > 0;

  return (
    <>
      {error && (
        <div className="catalog-error" role="alert">
          {error}
          <p className="catalog-error__sub">Убедитесь, что BooksApi запущен (например http://localhost:5130) и прокси Vite настроен.</p>
        </div>
      )}

      {loading && !hasBooks ? (
        <div className="catalog-loading">Загрузка каталога…</div>
      ) : !loading && !hasBooks ? (
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
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </div>
          Ничего не найдено. Измените поиск или фильтры.
        </div>
      ) : (
        <div style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 0.2s', pointerEvents: loading ? 'none' : 'auto' }}>
          <div className="books-grid">
            {books.map(book => (
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

          <div className="pagination-wrap">
            <span className="pagination__info">
              Страница {currentPage} из {totalPages} · {totalCount} книг
            </span>
            <Pagination
              current={currentPage}
              total={totalPages}
              onChange={onPageChange}
            />
          </div>
        </div>
      )}
    </>
  )
}

export default CatalogContent
