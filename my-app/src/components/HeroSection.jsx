const PLACEHOLDER_COVER = 'https://placehold.co/400x560/e8dfd4/9a6b3f?text=Book'

const HeroSection = ({ featured, onSelectBook }) => {
  const titleWords = featured?.title?.split(/\s+/).filter(Boolean) ?? []
  const leadTitle = titleWords.length > 1 ? titleWords.slice(0, -1).join(' ') : featured?.title
  const accentWord = titleWords.length > 1 ? titleWords.at(-1) : null

  return (
    <section className="hero" aria-label="Популярная книга">
      <div className="hero__inner">
        <div className="hero__content">
          <span className="hero__badge">Самая популярная сейчас</span>

          <h1 className="hero__title">
            {featured ? (
              accentWord ? (
                <>
                  {leadTitle}
                  <br />
                  <span>{accentWord}</span>
                </>
              ) : (
                <span>{featured.title}</span>
              )
            ) : (
              <>
                Откройте
                <br />
                <span>следующую книгу</span>
              </>
            )}
          </h1>

          {featured?.author ? (
            <p className="hero__author">{featured.author}</p>
          ) : null}

          <p className="hero__description">
            {featured?.description
              ? featured.description.length > 220
                ? `${featured.description.slice(0, 220)}…`
                : featured.description
              : 'Загрузите каталог с запущенным API — здесь появится книга с лучшим рейтингом.'}
          </p>

          {featured ? (
            <div className="hero__meta">
              {featured.rating > 0 ? (
                <span className="hero__meta-item">★ {Number(featured.rating).toFixed(1)}</span>
              ) : null}
              {featured.category ? (
                <span className="hero__meta-item">{featured.category}</span>
              ) : null}
              {featured.year ? (
                <span className="hero__meta-item">{featured.year}</span>
              ) : null}
            </div>
          ) : null}

          <div className="hero__buttons">
            <button
              type="button"
              className="btn btn--hero-primary"
              disabled={!featured}
              onClick={() => featured && onSelectBook(featured)}
            >
              Открыть книгу
            </button>
            <a className="hero__scroll" href="#explore">
              Смотреть каталог
            </a>
          </div>
        </div>

        <div className="hero__visual">
          <div className="hero__cover-frame">
            {featured ? (
              <img
                className="hero__cover-img"
                src={featured.cover}
                alt={featured.title}
                onError={(event) => {
                  event.currentTarget.onerror = null
                  event.currentTarget.src = PLACEHOLDER_COVER
                }}
              />
            ) : (
              <div className="hero__cover-placeholder" aria-hidden="true" />
            )}
          </div>

          {featured ? (
            <div className="hero__price-card">
              <span className="hero__price-label">Цена</span>
              <span className="hero__price-value">
                {featured.price?.replace(/\s/g, '\u00a0') ?? '—'}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      <a className="hero__down" href="#explore" aria-label="К каталогу">
        ↓
      </a>
    </section>
  )
}

export default HeroSection
