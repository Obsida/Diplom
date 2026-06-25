const ExploreHeader = ({
  loading,
  totalCount,
  filterSummaryParts,
}) => (
  <header className="section-header section-header--sidebar">
    <h2 className="section-header__title">Каталог</h2>
    <p className="section-header__sub">
      {loading ? 'Загрузка…' : `${totalCount} книг`}
      {filterSummaryParts.length ? ` · ${filterSummaryParts.join(', ')}` : ''}
    </p>
  </header>
)

export default ExploreHeader
