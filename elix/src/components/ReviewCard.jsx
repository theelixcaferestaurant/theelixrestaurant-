import { Star } from 'lucide-react';
import { formatReviewDate } from '../lib/reviews';

export function Stars({ value }) {
  return (
    <span className="stars" role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={15} className={n <= value ? 'is-on' : ''} aria-hidden="true" />
      ))}
    </span>
  );
}

// One approved customer review. Only the name, rating, message and date are ever shown.
export default function ReviewCard({ review }) {
  return (
    <figure className="review">
      <Stars value={review.rating} />
      <blockquote>{review.message}</blockquote>
      <figcaption>
        {review.name}
        <time className="review-date" dateTime={review.created_at}>
          {formatReviewDate(review.created_at)}
        </time>
      </figcaption>
    </figure>
  );
}
