import AdminBookEditor from './AdminBookEditor'
import { useModalBackdropClose } from '../../utils/useModalBackdropClose'

const TEXT_LIMITS = {
  title: 160,
  publisher: 120,
  synopsis: 4000,
}

const MIN_PUBLICATION_YEAR = 1000
const MAX_PUBLICATION_YEAR = new Date().getFullYear() + 1

export default function AdminBooksTab({
  booksLoading,
  filteredBooks,
  totalBooksCount = 0,
  bookListSearch,
  onBookListSearchChange,
  bookListFilter,
  onBookListFilterChange,
  bookListSort,
  onBookListSortChange,
  selectedBookId,
  onSelectBook,
  selectedBook,
  selectedBookDraft,
  authors,
  categories,
  savingBookId,
  archivingBookId,
  onDraftChange,
  onCategoryChange,
  onFileChange,
  onSave,
  onArchive,
  onUnarchive,
  onOpenAddModal,
  addBookModalOpen,
  onCloseAddModal,
  bookForm,
  onBookFormChange,
  onCreateBook,
  creatingBook,
  referencesLoading,
  selectedCreateCategory,
}) {
  const addBookBackdropClose = useModalBackdropClose(onCloseAddModal)

  return (
    <>
      <section className="admin-books-panel">
        <header className="admin-books-panel__toolbar">
          <div>
            <h2>Книги</h2>
            <p className="admin-muted">Список, поиск, фильтры и редактирование выбранной книги.</p>
          </div>
          <button type="button" className="btn btn--dark" onClick={onOpenAddModal}>
            + Добавить книгу
          </button>
        </header>

        <div className="admin-books-layout">
          <aside className="admin-books-list">
            <div className="admin-books-list__controls">
              <input
                className="catalog-field__input"
                type="search"
                placeholder="Поиск по названию, автору, ID..."
                value={bookListSearch}
                onChange={(event) => onBookListSearchChange(event.target.value)}
              />
              <select
                className="catalog-field__input"
                value={bookListFilter}
                onChange={(event) => onBookListFilterChange(event.target.value)}
              >
                <option value="all">Все книги</option>
                <option value="active">Только активные</option>
                <option value="archived">Только в архиве</option>
                <option value="emptyFields">С пустыми полями</option>
              </select>
              <select
                className="catalog-field__input"
                value={bookListSort}
                onChange={(event) => onBookListSortChange(event.target.value)}
              >
                <option value="title">Название</option>
                <option value="rating">Рейтинг</option>
                <option value="price">Цена</option>
                <option value="id">ID</option>
              </select>
            </div>

            {booksLoading ? <div className="catalog-loading">Загрузка каталога...</div> : null}

            <div className="admin-books-list__items" role="listbox" aria-label="Список книг">
              {!bookListSearch.trim() && bookListFilter !== 'emptyFields' ? (
                <div style={{
                  padding: '2.5rem 1rem',
                  textAlign: 'center',
                  background: 'var(--color-secondary)',
                  borderRadius: '12px',
                  border: '1px dashed var(--color-border)',
                  margin: '1rem 0'
                }}>
                  <svg
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--color-accent)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ marginBottom: '0.75rem', display: 'inline-block' }}
                  >
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  </svg>
                  <strong style={{ display: 'block', fontSize: '1.1rem', color: 'var(--color-text)' }}>
                    Всего книг в базе: {totalBooksCount}
                  </strong>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '0.5rem', lineHeight: '1.45' }}>
                    Начните вводить поисковый запрос в поле выше для отображения книг.
                  </p>
                </div>
              ) : (
                <>
                  {filteredBooks.length === 0 && !booksLoading ? (
                    <p className="admin-muted">Книги не найдены.</p>
                  ) : null}
                  {filteredBooks.map((book) => (
                    <button
                      key={book.bookId}
                      type="button"
                      role="option"
                      aria-selected={selectedBookId === book.bookId}
                      className={`admin-books-list__item ${selectedBookId === book.bookId ? 'admin-books-list__item--active' : ''}`}
                      onClick={() => onSelectBook(book.bookId)}
                    >
                      <strong>#{book.bookId} · {book.title}</strong>
                      <span>{book.authorName || 'Автор не указан'}</span>
                      <span>
                        {Number(book.rating).toFixed(1)} ★ · {book.isActive === false ? 'архив' : 'активна'}
                      </span>
                    </button>
                  ))}
                </>
              )}
            </div>
          </aside>

          <div className="admin-books-editor-wrap">
            <AdminBookEditor
              book={selectedBook}
              draft={selectedBookDraft}
              authors={authors}
              categories={categories}
              saving={savingBookId === selectedBookId}
              archiving={archivingBookId === selectedBookId}
              onDraftChange={onDraftChange}
              onCategoryChange={onCategoryChange}
              onFileChange={onFileChange}
              onSave={onSave}
              onArchive={onArchive}
              onUnarchive={onUnarchive}
            />
          </div>
        </div>
      </section>

      {addBookModalOpen ? (
        <div className="admin-modal-overlay" role="presentation" {...addBookBackdropClose}>
          <div
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-add-book-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="admin-modal__header">
              <div>
                <h2 id="admin-add-book-title">Новая книга</h2>
                <p className="admin-muted">Заполните форму и добавьте книгу в каталог.</p>
              </div>
              <button type="button" className="admin-modal__close" onClick={onCloseAddModal} aria-label="Закрыть">
                ×
              </button>
            </header>

            <form className="admin-form admin-modal__body" onSubmit={onCreateBook}>
              <label className="admin-field">
                <span className="admin-field__label">Название</span>
                <input
                  className="catalog-field__input"
                  value={bookForm.title}
                  onChange={(event) => onBookFormChange('title', event.target.value)}
                  maxLength={TEXT_LIMITS.title}
                  required
                />
              </label>
              <label className="admin-field">
                <span className="admin-field__label">Автор</span>
                <select
                  className="catalog-field__input"
                  value={bookForm.authorId}
                  onChange={(event) => onBookFormChange('authorId', event.target.value)}
                  required
                >
                  <option value="">Выберите автора</option>
                  {authors.map((author) => (
                    <option key={author.authorId} value={author.authorId}>
                      {author.fullName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="admin-field">
                <span className="admin-field__label">Категория</span>
                <select
                  className="catalog-field__input"
                  value={bookForm.categoryId}
                  onChange={(event) => {
                    onBookFormChange('categoryId', event.target.value)
                    onBookFormChange('subcategoryId', '')
                  }}
                  required
                >
                  <option value="">Выберите категорию</option>
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
                  value={bookForm.subcategoryId}
                  onChange={(event) => onBookFormChange('subcategoryId', event.target.value)}
                  required
                >
                  <option value="">Выберите подкатегорию</option>
                  {(selectedCreateCategory?.subcategories || []).map((subcategory) => (
                    <option key={subcategory.subcategoryId} value={subcategory.subcategoryId}>
                      {subcategory.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="admin-form__row admin-form__row--compact">
                <label className="admin-field">
                  <span className="admin-field__label">Год</span>
                  <input
                    className="catalog-field__input"
                    type="number"
                    min={MIN_PUBLICATION_YEAR}
                    max={MAX_PUBLICATION_YEAR}
                    value={bookForm.publicationYear}
                    onChange={(event) => onBookFormChange('publicationYear', event.target.value)}
                    required
                  />
                </label>
                <label className="admin-field">
                  <span className="admin-field__label">Цена</span>
                  <input
                    className="catalog-field__input"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={bookForm.price}
                    onChange={(event) => onBookFormChange('price', event.target.value)}
                    required
                  />
                </label>
                <label className="admin-field">
                  <span className="admin-field__label">Остаток</span>
                  <input
                    className="catalog-field__input"
                    type="number"
                    min="0"
                    value={bookForm.stockQuantity}
                    onChange={(event) => onBookFormChange('stockQuantity', event.target.value)}
                    required
                  />
                </label>
              </div>
              <label className="admin-field">
                <span className="admin-field__label">Издатель</span>
                <input
                  className="catalog-field__input"
                  value={bookForm.publisher}
                  onChange={(event) => onBookFormChange('publisher', event.target.value)}
                  maxLength={TEXT_LIMITS.publisher}
                  required
                />
              </label>
              <label className="admin-field">
                <span className="admin-field__label">Описание</span>
                <textarea
                  className="catalog-field__input admin-textarea"
                  value={bookForm.synopsis}
                  onChange={(event) => onBookFormChange('synopsis', event.target.value)}
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
                    required
                    onChange={(event) => onBookFormChange('cover', event.target.files?.[0] || null)}
                  />
                </label>
                <label className="admin-upload">
                  <span>PDF</span>
                  <input
                    className="admin-upload__input"
                    type="file"
                    accept="application/pdf,.pdf"
                    required
                    onChange={(event) => onBookFormChange('pdf', event.target.files?.[0] || null)}
                  />
                </label>
                <label className="admin-upload">
                  <span>Аудио</span>
                  <input
                    className="admin-upload__input"
                    type="file"
                    accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.webm"
                    required
                    onChange={(event) => onBookFormChange('audio', event.target.files?.[0] || null)}
                  />
                </label>
              </div>
              <div className="admin-modal__actions">
                <button type="button" className="btn btn--light" onClick={onCloseAddModal}>
                  Отмена
                </button>
                <button type="submit" className="btn btn--dark" disabled={creatingBook || referencesLoading}>
                  {creatingBook ? 'Добавляем...' : 'Добавить книгу'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
