const TEXT_LIMITS = {
  title: 160,
  publisher: 120,
  synopsis: 4000,
}

const MIN_PUBLICATION_YEAR = 1000
const MAX_PUBLICATION_YEAR = new Date().getFullYear() + 1

export default function AdminBookEditor({
  book,
  draft,
  authors,
  categories,
  saving,
  archiving,
  onDraftChange,
  onCategoryChange,
  onFileChange,
  onSave,
  onArchive,
  onUnarchive,
}) {
  if (!book || !draft) {
    return (
      <div className="admin-books-editor admin-books-editor--empty">
        <p>Выберите книгу из списка слева, чтобы отредактировать её данные.</p>
      </div>
    )
  }

  const selectedCategory = categories.find(
    (item) => Number(item.categoryId) === Number(draft.categoryId),
  )

  return (
    <div className="admin-books-editor">
      <header className="admin-books-editor__header">
        <div>
          <h2>#{book.bookId} · {book.title}</h2>
          <p className="admin-muted">
            Рейтинг {Number(book.rating).toFixed(1)} · PDF: {book.hasPdf ? 'да' : 'нет'} · Аудио:{' '}
            {book.hasAudio ? 'да' : 'нет'}
            {!book.isActive ? ' · в архиве' : ''}
          </p>
        </div>
      </header>

      <form
        className="admin-form"
        onSubmit={(event) => {
          event.preventDefault()
          onSave(book.bookId)
        }}
      >
        <label className="admin-field">
          <span className="admin-field__label">Название</span>
          <input
            className="catalog-field__input"
            value={draft.title}
            onChange={(event) => onDraftChange(book.bookId, 'title', event.target.value)}
            maxLength={TEXT_LIMITS.title}
            required
          />
        </label>

        <label className="admin-field">
          <span className="admin-field__label">Автор</span>
          <select
            className="catalog-field__input"
            value={draft.authorId}
            onChange={(event) => onDraftChange(book.bookId, 'authorId', event.target.value)}
          >
            <option value="">Автор</option>
            {authors.map((author) => (
              <option key={author.authorId} value={author.authorId}>
                {author.fullName}
              </option>
            ))}
          </select>
        </label>

        <div className="admin-form__row">
          <label className="admin-field">
            <span className="admin-field__label">Категория</span>
            <select
              className="catalog-field__input"
              value={draft.categoryId}
              onChange={(event) => onCategoryChange(book.bookId, event.target.value)}
            >
              <option value="">Категория</option>
              {categories.map((category) => (
                <option key={category.categoryId} value={category.categoryId}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-field">
            <span className="admin-field__label">Подкатегория</span>
            <select
              className="catalog-field__input"
              value={draft.subcategoryId}
              onChange={(event) => onDraftChange(book.bookId, 'subcategoryId', event.target.value)}
            >
              <option value="">Подкатегория</option>
              {(selectedCategory?.subcategories || []).map((subcategory) => (
                <option key={subcategory.subcategoryId} value={subcategory.subcategoryId}>
                  {subcategory.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="admin-form__row admin-form__row--compact">
          <label className="admin-field">
            <span className="admin-field__label">Год</span>
            <input
              className="catalog-field__input admin-field__input--compact"
              type="number"
              min={MIN_PUBLICATION_YEAR}
              max={MAX_PUBLICATION_YEAR}
              step="1"
              value={draft.publicationYear}
              onChange={(event) => onDraftChange(book.bookId, 'publicationYear', event.target.value)}
              required
            />
          </label>
          <label className="admin-field">
            <span className="admin-field__label">Цена</span>
            <input
              className="catalog-field__input admin-field__input--compact"
              type="number"
              step="0.01"
              min="0.01"
              value={draft.price}
              onChange={(event) => onDraftChange(book.bookId, 'price', event.target.value)}
              required
            />
          </label>
          <label className="admin-field">
            <span className="admin-field__label">Остаток</span>
            <input
              className="catalog-field__input admin-field__input--compact"
              type="number"
              min="0"
              step="1"
              value={draft.stockQuantity}
              onChange={(event) => onDraftChange(book.bookId, 'stockQuantity', event.target.value)}
              required
            />
          </label>
        </div>

        <label className="admin-field">
          <span className="admin-field__label">Издатель</span>
          <input
            className="catalog-field__input"
            value={draft.publisher}
            onChange={(event) => onDraftChange(book.bookId, 'publisher', event.target.value)}
            maxLength={TEXT_LIMITS.publisher}
            required
          />
        </label>

        <label className="admin-field">
          <span className="admin-field__label">Описание</span>
          <textarea
            className="catalog-field__input admin-textarea"
            value={draft.synopsis}
            onChange={(event) => onDraftChange(book.bookId, 'synopsis', event.target.value)}
            maxLength={TEXT_LIMITS.synopsis}
            required
          />
        </label>

        <div className="admin-form__upload-grid">
          <label className="admin-upload">
            <span>Обложка</span>
            <input
              className="admin-upload__input"
              type="file"
              accept="image/*"
              onChange={(event) => onFileChange(book.bookId, 'cover', event.target.files?.[0] || null)}
            />
          </label>
          <label className="admin-upload">
            <span>PDF</span>
            <input
              className="admin-upload__input"
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) => onFileChange(book.bookId, 'pdf', event.target.files?.[0] || null)}
            />
          </label>
          <label className="admin-upload">
            <span>Аудио</span>
            <input
              className="admin-upload__input"
              type="file"
              accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.webm"
              onChange={(event) => onFileChange(book.bookId, 'audio', event.target.files?.[0] || null)}
            />
          </label>
        </div>

        <div className="admin-actions">
          <button type="submit" className="btn btn--dark" disabled={saving}>
            {saving ? 'Сохраняем...' : 'Сохранить изменения'}
          </button>
          {book.isActive ? (
            <button
              type="button"
              className="btn btn--light"
              disabled={archiving}
              onClick={() => onArchive(book.bookId)}
            >
              {archiving ? 'Архивируем...' : 'В архив'}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--light"
              disabled={archiving}
              onClick={() => onUnarchive(book.bookId)}
            >
              {archiving ? 'Возвращаем...' : 'Убрать из архива'}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
