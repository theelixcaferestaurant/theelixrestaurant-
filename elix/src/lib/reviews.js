import { useCallback, useEffect, useRef, useState } from 'react';
import { isSupabaseConfigured, supabase } from './supabase';

// Customer reviews. Everything is stored in the Supabase database (migrations 0005, 0007, 0008).
//  * Reading: get_public_reviews() returns approved reviews only, public fields only.
//  * Writing: submit_review() saves name, email, optional phone, rating and text as 'pending'. The administrator approves it in /admin.
//    No email or SMS verification. The browser only ever holds the public anon key.

export const REVIEWS_AVAILABLE = isSupabaseConfigured;
export const EMPTY_REVIEWS_TEXT = 'No reviews yet. Be the first to share your experience at The Elix!';

const NETWORK_ERROR = 'We could not reach the server. Please check your internet connection and try again.';
const POLL_MS = 60_000;

// ---------------- submit (database function, no verification codes) ----------------
// Returns { ok: true } only after the database confirms the review is stored (always as "pending").
// Otherwise { ok: false, field, error }.
export async function submitReview(values) {
  if (!isSupabaseConfigured) return { ok: false, field: 'form', error: 'Reviews are not available right now. Please try again later.' };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ok: false, field: 'form', error: NETWORK_ERROR };
  try {
    const { data, error } = await supabase.rpc('submit_review', {
      p_name: values.name,
      p_email: values.email,
      p_mobile: values.mobile || '',
      p_rating: values.rating,
      p_message: values.message,
      p_website: values.website || '',
    });
    if (error) return { ok: false, field: 'form', error: 'Something went wrong on our side. Please try again in a moment.' };
    if (data && data.ok) return { ok: true };
    return { ok: false, field: (data && data.field) || 'form', error: (data && data.error) || 'Sorry, your review could not be saved. Please try again.' };
  } catch {
    return { ok: false, field: 'form', error: NETWORK_ERROR };
  }
}

// ---------------- public reading ----------------
export async function fetchApprovedReviews(limit = 100) {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('get_public_reviews', { p_limit: limit });
  if (error) throw error;
  const seen = new Set();
  return (data || []).filter((r) => (seen.has(r.id) ? false : seen.add(r.id)));
}

const signature = (list) => list.map((r) => `${r.id}|${r.rating}|${r.name}|${r.message}`).join('\n');

// Loads approved reviews. Stays fresh three ways, without hammering the API:
//  1. a content-free realtime ping when an administrator changes an approved review,
//  2. a 60 second refresh while the tab is visible (fallback if realtime is unavailable),
//  3. a refresh when the visitor returns to the tab.
export function useApprovedReviews(limit = 100) {
  const [state, setState] = useState({ loading: REVIEWS_AVAILABLE, error: false, reviews: [] });
  const inFlight = useRef(false);

  const load = useCallback(() => {
    if (!REVIEWS_AVAILABLE || inFlight.current) return Promise.resolve();
    inFlight.current = true;
    return fetchApprovedReviews(limit)
      .then((reviews) =>
        setState((s) => (!s.loading && !s.error && signature(s.reviews) === signature(reviews) ? s : { loading: false, error: false, reviews })))
      .catch(() => setState((s) => ({ ...s, loading: false, error: s.reviews.length === 0 })))
      .finally(() => { inFlight.current = false; });
  }, [limit]);

  useEffect(() => {
    if (!REVIEWS_AVAILABLE) return undefined;
    load();

    let debounce;
    const ping = () => { clearTimeout(debounce); debounce = setTimeout(load, 400); };
    const channel = supabase.channel('public-reviews').on('broadcast', { event: 'reviews_changed' }, ping).subscribe();

    const poll = setInterval(() => document.visibilityState === 'visible' && load(), POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearTimeout(debounce);
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
      supabase.removeChannel(channel);
    };
  }, [load]);

  return { ...state, reload: load };
}

// ---- format checks used by the form (the database repeats every one of them) ----
export const EMAIL_PATTERN = /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i;

export function normalizeEmail(raw) {
  const email = String(raw || '').trim().toLowerCase();
  if (!email || email.length > 254 || email.includes('..') || !EMAIL_PATTERN.test(email)) return null;
  return email;
}

// Phone is optional. Empty is fine; otherwise 7-15 digits with an optional leading +.
export function isValidPhone(raw) {
  const compact = String(raw || '').replace(/[\s\-().]/g, '');
  return compact === '' || /^\+?[0-9]{7,15}$/.test(compact);
}

export function validateReview(values) {
  const errors = {};
  const name = values.name.replace(/\s+/g, ' ').trim();
  const message = values.message.trim();
  if (!name) errors.name = 'Please enter your name.';
  else if (name.length > 80) errors.name = 'Please keep your name to 80 characters.';
  if (!values.email.trim()) errors.email = 'Please enter your email address.';
  else if (!normalizeEmail(values.email)) errors.email = 'Please enter an email address like name@example.com.';
  if (!isValidPhone(values.mobile)) errors.mobile = 'Please enter a valid phone number, or leave it empty.';
  if (!values.rating) errors.rating = 'Please choose a star rating.';
  if (!message) errors.message = 'Please write your review.';
  else if (message.length > 1000) errors.message = 'Please keep your review to 1,000 characters.';
  return errors;
}

export const formatReviewDate = (iso) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
