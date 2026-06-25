import StarRating from './StarRating'

const PLACEHOLDER_COVER = 'https://placehold.co/280x400/2f2f2f/bfa054?text=Book'

const PopularSection = ({ popular, onSelectBook, bookmarkedBookIds }) => (
  <section className="popular">
    <h2 className="popular__title">Популярные книги</h2>
    <div className="popular__list">
      {popular.length === 0 ? (
        <p className="popular__empty">Нет данных для блока «Популярное».</p>
      ) : (
        popular.map((book, i) => (
          <div key={book.id} className="popular-item" onClick={() => onSelectBook(book)}>
            <span className="popular-item__index">{String(i + 1).padStart(2, '0')}</span>
            <div className="popular-item__cover-frame">
              <img
                className="popular-item__cover"
                src={book.cover}
                alt={book.title}
                onError={(e) => {
                  e.currentTarget.onerror = null
                  e.currentTarget.src = PLACEHOLDER_COVER
                }}
              />
            </div>
            <div className="popular-item__info">
              <div className="popular-item__title">{book.title}</div>
              <div className="popular-item__author">{book.author}</div>
              <StarRating rating={book.rating} />
              <span className="popular-item__reviews">рейтинг</span>
              {bookmarkedBookIds?.includes(book.bookId) ? (
                <span className="popular-item__bookmark">В закладках</span>
              ) : null}
            </div>
            <div className="popular-item__price">{book.price}</div>
          </div>
        ))
      )}
    </div>
  </section>
)

export default PopularSection
