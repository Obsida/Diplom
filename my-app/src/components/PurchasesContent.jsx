import { formatDeliveryStatus } from '../utils/deliveryStatus'

const formatAmount = (value) => {
  const n = Number(value)
  if (Number.isNaN(n)) return '—'
  return `${n.toLocaleString('ru-RU')} ₽`
}

const formatDate = (value) => {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('ru-RU')
}

const PurchasesContent = ({ loading, error, purchases, onBack }) => (
  <>
    <div className="section-header">
      <div>
        <div className="section-header__title">Заказы</div>
        <div className="section-header__sub">
          {loading ? 'Загрузка…' : `${purchases.length} заказов`}
        </div>
      </div>
      <div className="section-header__filters">
        <button type="button" className="btn btn--light" onClick={onBack}>В каталог</button>
      </div>
    </div>

    {error ? (
      <div className="catalog-error" role="alert">
        {error}
      </div>
    ) : null}

    {loading ? (
      <div className="catalog-loading">Загрузка покупок…</div>
    ) : purchases.length === 0 ? (
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
            <circle cx="9" cy="21" r="1" />
            <circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
          </svg>
        </div>
        У вас пока нет заказов.
      </div>
    ) : (
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Трек №</th>
              <th>Книга</th>
              <th>Сумма</th>
              <th>Адрес</th>
              <th>Дата</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {purchases.map((p) => {
              const trackId = p.deliveryOrderId ?? p.orderId ?? p.id ?? p.purchaseId ?? '—'
              return (
                <tr key={trackId}>
                  <td className="track-number" data-label="Трек">#{trackId}</td>
                  <td data-label="Книга">{p.bookTitle || p.title || `Книга #${p.bookId}`}</td>
                  <td data-label="Сумма">{formatAmount(p.amount ?? p.totalAmount)}</td>
                  <td data-label="Адрес">{p.deliveryAddress || '—'}</td>
                  <td data-label="Дата">{formatDate(p.purchaseDate || p.orderDate)}</td>
                  <td data-label="Статус">
                    <span className={`status-badge status-badge--${(p.status || 'created').toLowerCase()}`}>
                      {formatDeliveryStatus(p.status)}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )}
  </>
)

export default PurchasesContent
