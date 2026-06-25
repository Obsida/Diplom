const Pagination = ({ current, total, onChange }) => {
  if (total <= 1) return null

  const pages = []
  for (let i = 1; i <= total; i++) {
    if (
      i === 1 || i === total ||
      (i >= current - 1 && i <= current + 1)
    ) {
      pages.push(i)
    } else if (
      (i === current - 2 && current > 3) ||
      (i === current + 2 && current < total - 2)
    ) {
      pages.push('...')
    }
  }

  const dedupedPages = pages.filter((p, idx) => !(p === '...' && pages[idx - 1] === '...'))

  return (
    <div className="pagination">
      <button
        type="button"
        className="pagination__btn pagination__btn--arrow"
        disabled={current === 1}
        onClick={() => onChange(current - 1)}
      >
        ‹
      </button>

      {dedupedPages.map((p, idx) =>
        p === '...' ? (
          <span key={`dots-${idx}`} className="pagination__dots">…</span>
        ) : (
          <button
            key={p}
            type="button"
            className={`pagination__btn ${p === current ? 'pagination__btn--active' : ''}`}
            onClick={() => onChange(p)}
          >
            {p}
          </button>
        )
      )}

      <button
        type="button"
        className="pagination__btn pagination__btn--arrow"
        disabled={current === total}
        onClick={() => onChange(current + 1)}
      >
        ›
      </button>
    </div>
  )
}

export default Pagination
