import React, { useState, useEffect } from 'react'
import BookCard from './BookCard'

export default function RecommendationsSection({
  recommendations,
  onSelectBook,
  bookmarkedBookIds,
  onAddToCart,
  cartBookIds,
}) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [itemsPerPage, setItemsPerPage] = useState(4)

  const visibleBooks = Array.isArray(recommendations) ? recommendations.slice(0, 8) : []

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 640) {
        setItemsPerPage(1)
      } else if (window.innerWidth < 960) {
        setItemsPerPage(2)
      } else if (window.innerWidth < 1200) {
        setItemsPerPage(3)
      } else {
        setItemsPerPage(4)
      }
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  if (visibleBooks.length === 0) {
    return null
  }

  const maxIndex = Math.max(0, visibleBooks.length - itemsPerPage)

  const handlePrev = () => {
    setCurrentIndex((prev) => Math.max(0, prev - 1))
  }

  const handleNext = () => {
    setCurrentIndex((prev) => Math.min(maxIndex, prev + 1))
  }

  // Сброс индекса, если он выходит за рамки при изменении размера экрана
  const correctedIndex = Math.min(currentIndex, maxIndex)

  return (
    <section className="recommendations-section" style={{ margin: '2rem 0 3rem', position: 'relative' }}>

      <header className="section-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h2 className="section-header__title" style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--color-text)' }}>
            Рекомендовано для вас
          </h2>
          <p className="section-header__sub" style={{ fontSize: '0.95rem', color: 'var(--color-text-muted)', marginTop: '0.3rem' }}>
            Персональная подборка книг на основе ваших предпочтений и истории чтения
          </p>
        </div>
      </header>

      <div className="carousel-wrapper">
        {visibleBooks.length > itemsPerPage && (
          <>
            <button
              onClick={handlePrev}
              disabled={correctedIndex === 0}
              aria-label="Предыдущий слайд"
              className="carousel-nav-btn carousel-nav-btn--prev"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
            <button
              onClick={handleNext}
              disabled={correctedIndex >= maxIndex}
              aria-label="Следующий слайд"
              className="carousel-nav-btn carousel-nav-btn--next"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </>
        )}

        <div className="carousel-container" style={{ overflow: 'hidden', margin: '0 -0.75rem', padding: '0.5rem 0' }}>
          <div
            className="carousel-track"
            style={{
              display: 'flex',
              transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              transform: `translateX(-${correctedIndex * (100 / itemsPerPage)}%)`,
            }}
          >
            {visibleBooks.map((book) => {
              const isBookmarked = bookmarkedBookIds?.includes(book.bookId)
              const isInCart = cartBookIds?.includes(book.bookId)
              return (
                <div
                  key={book.bookId}
                  style={{
                    width: `${100 / itemsPerPage}%`,
                    flexShrink: 0,
                    padding: '0 0.75rem',
                    boxSizing: 'border-box',
                  }}
                >
                  <BookCard
                    book={book}
                    onClick={onSelectBook}
                    isBookmarked={isBookmarked}
                    onAddToCart={onAddToCart}
                    isInCart={isInCart}
                    isOwned={false}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
