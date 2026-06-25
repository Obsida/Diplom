import StarRating from './StarRating'

const PLACEHOLDER_COVER = 'https://placehold.co/280x400/2f2f2f/bfa054?text=Book'

const BookCard = ({ book, onClick, isBookmarked, onAddToCart, isInCart, isOwned }) => (
  <div
    className="book-card"
    onClick={(e) => {
      if (e.target.closest('button')) return
      onClick(book)
    }}
  >
    <div className="book-card__image-wrap">
      <img
        className="book-card__image"
        src={book.cover}
        alt={book.title}
        onError={e => {
          e.currentTarget.onerror = null
          e.currentTarget.src = PLACEHOLDER_COVER
        }}
      />
      <div className="book-card__overlay" />
      <span className="book-card__category-badge">{book.category}</span>
      {isBookmarked ? <span className="book-card__bookmark-badge">В закладках</span> : null}
    </div>
    <div className="book-card__body">
      <h3 className="book-card__title">{book.title}</h3>
      <p className="book-card__author">{book.author}</p>
      <div className="book-card__meta">
        <div>
          <StarRating rating={book.rating} />
          {book.reviews != null && (
            <span className="book-card__reviews"> ({book.reviews})</span>
          )}
        </div>
        <span className="book-card__price">{book.price}</span>
      </div>
      <button
        type="button"
        className="btn btn--card"
        onClick={(e) => {
          e.stopPropagation()
          if (!isOwned && !isInCart) {
            onAddToCart?.(book)
          }
        }}
        disabled={isOwned || isInCart}
      >
        {isOwned ? 'В библиотеке' : isInCart ? 'В корзине' : 'Купить печатную'}
      </button>
    </div>
  </div>
)

export default BookCard