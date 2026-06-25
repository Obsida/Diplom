const CatalogToolbar = ({
  variant = 'default',
  search,
  onSearchChange,
  categories = [],
  categoryId,
  onCategoryChange,
  subcategories,
  subcategoryId,
  onSubcategoryChange,
  authors,
  authorId,
  onAuthorChange,
  minRating,
  onMinRatingChange,
  minPrice,
  onMinPriceChange,
  maxPrice,
  onMaxPriceChange,
  publicationYear,
  onPublicationYearChange,
  sortBy,
  onSortByChange,
  onClearFilters,
}) => {
  const fieldClass = (active, disabled = false) =>
    `catalog-field${active ? ' catalog-field--active' : ''}${disabled ? ' catalog-field--disabled' : ''}`

  return (
    <div className={`catalog-toolbar ${variant === 'sidebar' ? 'catalog-toolbar--sidebar' : ''}`}>
      <div className="catalog-toolbar__grid">
        <label className={fieldClass(Boolean(search.trim()))}>
          <span className="catalog-field__label">Поиск</span>
          <input
            className="catalog-field__input"
            type="search"
            placeholder="Название, автор..."
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>

        <label className={fieldClass(categoryId != null)}>
          <span className="catalog-field__label">Жанр</span>
          <select
            className="catalog-field__input"
            value={categoryId ?? ''}
            onChange={(event) => onCategoryChange(event.target.value ? Number(event.target.value) : null)}
          >
            <option value="">Все жанры</option>
            {categories.filter((item) => item.isActive !== false).map((item) => (
              <option key={item.categoryId} value={item.categoryId}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <label className={fieldClass(subcategoryId != null, !categoryId)}>
          <span className="catalog-field__label">Поджанр</span>
          <select
            className="catalog-field__input"
            value={subcategoryId ?? ''}
            onChange={(event) => onSubcategoryChange(event.target.value ? Number(event.target.value) : null)}
            disabled={!categoryId}
          >
            <option value="">Все поджанры</option>
            {subcategories.filter((item) => item.isActive !== false).map((item) => (
              <option key={item.subcategoryId} value={item.subcategoryId}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <label className={fieldClass(authorId != null)}>
          <span className="catalog-field__label">Автор</span>
          <select
            className="catalog-field__input"
            value={authorId ?? ''}
            onChange={(event) => onAuthorChange(event.target.value ? Number(event.target.value) : null)}
          >
            <option value="">Все авторы</option>
            {authors.map((author) => (
              <option key={author.authorId} value={author.authorId}>
                {author.fullName}
              </option>
            ))}
          </select>
        </label>

        <label className={fieldClass(minRating !== '')}>
          <span className="catalog-field__label">Рейтинг</span>
          <select
            className="catalog-field__input"
            value={minRating}
            onChange={(event) => onMinRatingChange(event.target.value)}
          >
            <option value="">Любой</option>
            <option value="3">от 3</option>
            <option value="3.5">от 3.5</option>
            <option value="4">от 4</option>
            <option value="4.5">от 4.5</option>
          </select>
        </label>

        <label className={fieldClass(minPrice !== '')}>
          <span className="catalog-field__label">Цена от</span>
          <input
            className="catalog-field__input"
            type="number"
            min={0}
            step={1}
            placeholder="0"
            value={minPrice}
            onChange={(event) => onMinPriceChange(event.target.value)}
          />
        </label>

        <label className={fieldClass(maxPrice !== '')}>
          <span className="catalog-field__label">Цена до</span>
          <input
            className="catalog-field__input"
            type="number"
            min={0}
            step={1}
            placeholder="∞"
            value={maxPrice}
            onChange={(event) => onMaxPriceChange(event.target.value)}
          />
        </label>

        <label className={fieldClass(publicationYear.trim() !== '')}>
          <span className="catalog-field__label">Год</span>
          <input
            className="catalog-field__input"
            type="number"
            min={1000}
            max={2100}
            step={1}
            placeholder="2020"
            value={publicationYear}
            onChange={(event) => onPublicationYearChange(event.target.value)}
          />
        </label>

        <label className={fieldClass(sortBy !== '')}>
          <span className="catalog-field__label">Сортировка</span>
          <select
            className="catalog-field__input"
            value={sortBy}
            onChange={(event) => onSortByChange(event.target.value)}
          >
            <option value="">По умолчанию</option>
            <option value="title">Название</option>
            <option value="rating">Рейтинг</option>
            <option value="price_asc">Цена ↑</option>
            <option value="price_desc">Цена ↓</option>
          </select>
        </label>

        <div className="catalog-field catalog-field--action">
          <span className="catalog-field__label">&nbsp;</span>
          <button type="button" className="btn btn--filter btn--filter-inactive catalog-reset" onClick={onClearFilters}>
            Сбросить
          </button>
        </div>
      </div>
    </div>
  )
}

export default CatalogToolbar
