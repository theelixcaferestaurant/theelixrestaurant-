import { usePageTitle } from '../hooks/usePage';
import ReviewCard, { Stars } from '../components/ReviewCard';
import ReviewForm from '../components/ReviewForm';
import BackButton from '../components/BackButton';
import { EMPTY_REVIEWS_TEXT, REVIEWS_AVAILABLE, useApprovedReviews } from '../lib/reviews';

export default function Reviews() {
  usePageTitle('Reviews | The Elix');
  const { loading, error, reviews } = useApprovedReviews(100);

  const average = reviews.length ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10 : null;
  const [lead, ...rest] = reviews; // newest first

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <BackButton to="/" />
          <h1 className="display-xl">Reviews</h1>
          <p className="lead">What our guests say about The Elix.</p>
        </div>
      </section>

      <section className="section-tight">
        <div className="container">
          {loading && <p className="muted" role="status">Loading reviews…</p>}

          {!loading && error && (
            <p className="muted" role="status">Reviews could not be loaded right now. Please try again shortly.</p>
          )}

          {!loading && !error && reviews.length === 0 && (
            <p className="reviews-empty" role="status">{EMPTY_REVIEWS_TEXT}</p>
          )}

          {!loading && !error && reviews.length > 0 && (
            <>
              <div className="reviews-layout">
                <div className="rating-summary">
                  <span className="rating-number">{average.toFixed(1)}</span>
                  <Stars value={Math.round(average)} />
                  <p>Average of {reviews.length} guest {reviews.length === 1 ? 'review' : 'reviews'}</p>
                </div>
                <div className="review-lead">
                  <ReviewCard review={lead} />
                </div>
              </div>

              {rest.length > 0 && (
                <div className="review-grid">
                  {rest.map((review) => (
                    <ReviewCard key={review.id} review={review} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <section className="section-tight">
        <div className="container review-form-wrap">
          {REVIEWS_AVAILABLE ? (
            <ReviewForm />
          ) : (
            <p className="muted" role="status">Reviews are not available on this website yet.</p>
          )}
        </div>
      </section>
    </>
  );
}
