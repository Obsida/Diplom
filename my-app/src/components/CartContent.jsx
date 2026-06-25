const formatPrice = (n) => {
  const x = Number(n)
  if (Number.isNaN(x)) return '—'
  return `${x.toLocaleString('ru-RU')} ₽`
}

const parsePrice = (item) => {
  const v = Number(item.priceValue)
  if (!Number.isNaN(v)) return v
  const cleaned = String(item.price ?? '').replace(/[^\d,.-]/g, '').replace(',', '.')
  const parsed = parseFloat(cleaned)
  return Number.isNaN(parsed) ? 0 : parsed
}

const CartContent = ({
  items,
  onBack,
  onRemove,
  onBuyOne,
  onBuyAll,
  busyBookId,
  buyingAll,
}) => {
  const total = items.reduce((sum, item) => sum + parsePrice(item), 0)

  return (
    <>
      <div className="section-header">
        <div>
          <div className="section-header__title">Корзина</div>
          <div className="section-header__sub">{items.length} книг</div>
        </div>
        <div className="section-header__filters">
          <button type="button" className="btn btn--light" onClick={onBack}>В каталог</button>
        </div>
      </div>

      {items.length === 0 ? (
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
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
          Корзина пуста. Добавьте книги из каталога.
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Книга</th>
                <th>Автор</th>
                <th>Цена</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={`${item.bookId}-${item.isElectronic ? 'electronic' : 'physical'}`}>
                  <td data-label="Книга">
                    {item.title}
                    <span
                      style={{
                        marginLeft: '8px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '0.8rem',
                        fontWeight: 'bold',
                        background: item.isElectronic ? '#e8f5e9' : '#e0f7fa',
                        color: item.isElectronic ? '#2e7d32' : '#006064',
                        border: `1px solid ${item.isElectronic ? '#c8e6c9' : '#b2ebf2'}`,
                      }}
                    >
                      {item.isElectronic ? 'Электронная' : 'Печатная'}
                    </span>
                  </td>
                  <td data-label="Автор">{item.author}</td>
                  <td data-label="Цена">{item.price || formatPrice(item.priceValue)}</td>
                  <td data-label="Действия">
                    <button type="button" className="btn btn--light" onClick={() => onRemove(item.bookId, item.isElectronic)}>
                      Удалить
                    </button>
                    {' '}
                    <button
                      type="button"
                      className="btn btn--dark"
                      onClick={() => onBuyOne(item)}
                      disabled={busyBookId === item.bookId || buyingAll}
                    >
                      {busyBookId === item.bookId ? 'Оформление…' : item.isElectronic ? 'Купить' : 'Заказать'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="cart-summary">
            <strong>Итого: {formatPrice(total)}</strong>
            <button type="button" className="btn btn--dark" onClick={onBuyAll} disabled={buyingAll}>
              {buyingAll ? 'Оформление…' : 'Заказать все'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export default CartContent
