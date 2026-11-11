import { useRef, useState } from 'react';
import { Star } from 'lucide-react';
import { submitReview, validateReview } from '../lib/reviews';

const EMPTY = { name: '', email: '', mobile: '', rating: 0, message: '', website: '' };
const MAX_MESSAGE = 1000;
const RATING_WORDS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

// "Send a review" form (Contact page and Reviews page). Name, email, phone (optional), topic, rating, review.
// No email or SMS verification. Every review is saved as "pending" and shows on the Reviews page only after
// the administrator approves it in /admin.
export default function ReviewForm({ onSubmitted }) {
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [hover, setHover] = useState(0);
  const sending = useRef(false); // blocks a second submit before React has re-rendered

  const update = (field) => (event) => {
    setValues((v) => ({ ...v, [field]: event.target.value }));
    setErrors((e) => ({ ...e, [field]: undefined, form: undefined }));
  };
  const setRating = (rating) => {
    setValues((v) => ({ ...v, rating }));
    setErrors((e) => ({ ...e, rating: undefined }));
  };
  const onStarKey = (event) => {
    const keys = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 };
    if (!keys[event.key]) return;
    event.preventDefault();
    setRating(Math.min(5, Math.max(1, (values.rating || 0) + keys[event.key])));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (sending.current) return;
    const found = validateReview(values);
    setErrors(found);
    if (Object.keys(found).length) {
      const first = ['name', 'email', 'mobile', 'rating', 'message'].find((k) => found[k]);
      document.getElementById(`rv-${first}`)?.focus();
      return;
    }
    sending.current = true;
    setBusy(true);
    const result = await submitReview({
      name: values.name.replace(/\s+/g, ' ').trim(),
      email: values.email.trim().toLowerCase(),
      mobile: values.mobile.trim(),
      rating: values.rating,
      message: values.message.trim(),
      website: values.website,
    });
    setBusy(false);
    sending.current = false;
    if (result.ok) {
      setSent(true);
      setValues(EMPTY);
      setErrors({});
      onSubmitted?.();
      return;
    }
    setErrors({ [result.field || 'form']: result.error });
  };

  if (sent) {
    return (
      <div className="form-success review-form-done" role="status">
        <h2>Thank you for your review.</h2>
        <p>Your review has been saved. It will appear on the Reviews page once our team has approved it.</p>
        <button type="button" className="btn btn-ghost" onClick={() => setSent(false)}>
          Write another review
        </button>
      </div>
    );
  }

  const shown = hover || values.rating;
  const err = (key) => (errors[key] ? <p id={`rv-${key}-err`} className="field-error" role="alert">{errors[key]}</p> : null);
  const used = values.message.length;

  return (
    <form className="contact-form review-form" onSubmit={submit} noValidate>
      <h2>Send a review</h2>
      <p className="muted">Tell us about your visit. Your review will appear on the Reviews page after our team approves it.</p>

      <fieldset className="rv-fields" disabled={busy}>
        <div className="field">
          <label htmlFor="rv-name">Name</label>
          <input id="rv-name" type="text" value={values.name} onChange={update('name')} maxLength={80} autoComplete="name"
            aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'rv-name-err' : undefined} />
          {err('name')}
        </div>

        <div className="field">
          <label htmlFor="rv-email">Email</label>
          <input id="rv-email" type="email" value={values.email} onChange={update('email')} maxLength={254} autoComplete="email" inputMode="email"
            aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'rv-email-err' : undefined} />
          {err('email')}
        </div>

        <div className="field-pair">
          <div className="field">
            <label htmlFor="rv-mobile">Phone (optional)</label>
            <input id="rv-mobile" type="tel" value={values.mobile} onChange={update('mobile')} maxLength={20} autoComplete="tel" inputMode="tel"
              aria-invalid={Boolean(errors.mobile)} aria-describedby={errors.mobile ? 'rv-mobile-err' : undefined} />
            {err('mobile')}
          </div>
          <div className="field">
            <label htmlFor="rv-topic">Topic</label>
            <select id="rv-topic" value="Review" onChange={() => {}}>
              <option>Review</option>
            </select>
          </div>
        </div>

        <div className="field">
          <span className="rating-label" id="rv-rating-label">Rating</span>
          <div id="rv-rating" className="star-input" role="radiogroup" aria-labelledby="rv-rating-label" aria-describedby={errors.rating ? 'rv-rating-err' : undefined} onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={values.rating === n}
                aria-label={`${n} star${n > 1 ? 's' : ''}`}
                tabIndex={values.rating === n || (!values.rating && n === 1) ? 0 : -1}
                className={`star-btn ${n <= shown ? 'is-on' : ''}`}
                onClick={() => setRating(n)}
                onMouseEnter={() => setHover(n)}
                onKeyDown={onStarKey}
              >
                <Star size={34} aria-hidden="true" />
              </button>
            ))}
            <span className="star-word" aria-live="polite">{RATING_WORDS[values.rating] || 'Tap a star'}</span>
          </div>
          {err('rating')}
        </div>

        <div className="field">
          <label htmlFor="rv-message">Review</label>
          <textarea id="rv-message" rows={5} value={values.message} onChange={update('message')} maxLength={MAX_MESSAGE}
            aria-invalid={Boolean(errors.message)} aria-describedby={errors.message ? 'rv-message-err' : 'rv-count'} />
          <p id="rv-count" className="field-count">{used} / {MAX_MESSAGE}</p>
          {err('message')}
        </div>
      </fieldset>

      {/* Spam trap: hidden from people, often filled by bots. */}
      <div className="rv-trap" aria-hidden="true">
        <label htmlFor="rv-website">Website</label>
        <input id="rv-website" type="text" tabIndex={-1} autoComplete="off" value={values.website} onChange={update('website')} />
      </div>

      {errors.form && <p className="field-error form-error" role="alert">{errors.form}</p>}

      <button type="submit" className="btn" disabled={busy} aria-busy={busy}>
        {busy ? 'Sending…' : 'Send review'}
      </button>

      <p className="muted privacy-note">
        Your email address and phone number are never shown publicly. Your name, rating and review are shown once approved.
      </p>
    </form>
  );
}
