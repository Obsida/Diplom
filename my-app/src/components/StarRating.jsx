const StarRating = ({ rating }) => {
  const r = Number(rating) || 0
  return (
    <span className="star-rating">
      {'★'.repeat(Math.floor(r))}
      {r % 1 >= 0.5 ? '☆' : ''}
    </span>
  )
}

export default StarRating
