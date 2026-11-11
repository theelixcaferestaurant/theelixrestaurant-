// Menu item availability, shared by the public website and the dashboard.
//
//  * availability 'unavailable'  -> shown with a "Currently Unavailable" label. With an "until" date/time it switches
//    back to available by itself when that moment passes.
//  * serving hours (from / to)   -> the item is available only between those times every day; outside them it shows
//    the same label. "to" earlier than "from" means the window continues past midnight.
// All clock times are the restaurant's local time (Hyderabad), whatever timezone the visitor's device is in.

export const RESTAURANT_TZ = 'Asia/Kolkata';
export const UNAVAILABLE_LABEL = 'Currently Unavailable';

const clock = new Intl.DateTimeFormat('en-GB', { timeZone: RESTAURANT_TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

// Minutes since midnight in the restaurant's timezone.
export function minutesNow(now = Date.now()) {
  const parts = clock.formatToParts(new Date(now));
  const h = Number(parts.find((p) => p.type === 'hour').value);
  const m = Number(parts.find((p) => p.type === 'minute').value);
  return h * 60 + m;
}

// "05:30:00" or "05:30" -> 330
export function timeToMinutes(text) {
  const [h, m] = String(text).split(':');
  return Number(h) * 60 + Number(m || 0);
}

export function isInWindow(fromText, toText, now = Date.now()) {
  const a = timeToMinutes(fromText);
  const b = timeToMinutes(toText);
  if (a === b) return true;
  const m = minutesNow(now);
  return a < b ? m >= a && m < b : m >= a || m < b;
}

// item uses the shape the public site uses: { availability, unavailableUntil, availFrom, availTo }
export function isUnavailable(item, now = Date.now()) {
  if (!item) return false;
  if (item.availability === 'unavailable') {
    if (!item.unavailableUntil) return true;
    const until = Date.parse(item.unavailableUntil);
    if (Number.isNaN(until) || now < until) return true;
  }
  if (item.availFrom && item.availTo && !isInWindow(item.availFrom, item.availTo, now)) return true;
  return false;
}

// ---- date/time helpers for the dashboard (restaurant time <-> database timestamp) ----
const IST_OFFSET = '+05:30'; // India has no daylight saving time, so the offset is constant.

// "2026-11-08T14:30" (typed in restaurant time) -> ISO string for the database. '' -> null.
export function localInputToIso(value) {
  if (!value) return null;
  const d = new Date(`${value}:00${IST_OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// ISO string from the database -> "2026-11-08T14:30" in restaurant time, for <input type="datetime-local">.
export function isoToLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(Date.parse(iso) + 5.5 * 3600 * 1000);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 16);
}

export function formatRestaurantDateTime(iso) {
  return new Date(iso).toLocaleString('en-IN', { timeZone: RESTAURANT_TZ, day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export const to12h = (text) => {
  if (!text) return '';
  const [h, m] = String(text).split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m || 0).padStart(2, '0')} ${suffix}`;
};

// Same check for a raw database row (snake_case column names), used by the dashboard.
export const isRowUnavailable = (row, now = Date.now()) =>
  isUnavailable({ availability: row.availability, unavailableUntil: row.unavailable_until, availFrom: row.available_from, availTo: row.available_to }, now);
