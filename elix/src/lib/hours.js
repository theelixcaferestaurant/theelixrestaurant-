import { RESTAURANT_TZ, to12h, timeToMinutes } from './availability';

// Pure helpers that turn the opening-hours tables into the text the public website shows.
// Weekdays follow the database: 0 = Sunday ... 6 = Saturday.

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHOW_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first when the days differ

const dayText = (row) => (!row || row.is_closed ? 'Closed' : `${to12h(row.opens)} – ${to12h(row.closes)}`);
const sameDay = (a, b) => dayText(a) === dayText(b);
const isOvernight = (row) => row && !row.is_closed && timeToMinutes(row.closes) <= timeToMinutes(row.opens);

// weekly rows -> { lines: [{ days, time }], note, uniformOpen }
export function summariseWeeklyHours(rows) {
  const byDay = new Map((rows || []).map((r) => [Number(r.day_of_week), r]));
  if (byDay.size === 0) return null;

  const days = SHOW_ORDER.filter((d) => byDay.has(d));
  const allSame = days.every((d) => sameDay(byDay.get(d), byDay.get(days[0])));
  const allOpen = days.every((d) => !byDay.get(d).is_closed);

  if (allSame && days.length === 7) {
    const first = byDay.get(days[0]);
    const note = allOpen ? (isOvernight(first) ? `Open daily · Closes at ${to12h(first.closes)} the following day.` : 'Open daily.') : 'Closed every day.';
    return { lines: [{ days: 'Sunday – Saturday', time: dayText(first) }], note, uniformOpen: allOpen };
  }

  const lines = [];
  let run = [days[0]];
  const flush = () => {
    const first = DAY_NAMES[run[0]];
    const last = DAY_NAMES[run[run.length - 1]];
    lines.push({ days: run.length === 1 ? first : `${first} – ${last}`, time: dayText(byDay.get(run[0])) });
  };
  for (let i = 1; i < days.length; i += 1) {
    if (sameDay(byDay.get(days[i]), byDay.get(run[0]))) run.push(days[i]);
    else {
      flush();
      run = [days[i]];
    }
  }
  flush();
  const overnight = days.some((d) => isOvernight(byDay.get(d)));
  return { lines, note: overnight ? 'Closing times after midnight are on the following day.' : '', uniformOpen: false };
}

// Today's date (YYYY-MM-DD) in the restaurant's timezone.
export const todayInRestaurantTz = (now = Date.now()) => new Intl.DateTimeFormat('en-CA', { timeZone: RESTAURANT_TZ }).format(new Date(now));

// special_hours rows -> upcoming ones (today or later, next 60 days), sorted, as display lines.
export function upcomingSpecialHours(rows, now = Date.now(), horizonDays = 60) {
  const today = todayInRestaurantTz(now);
  const limit = todayInRestaurantTz(now + horizonDays * 86400000);
  return (rows || [])
    .filter((r) => r.on_date >= today && r.on_date <= limit)
    .sort((a, b) => a.on_date.localeCompare(b.on_date))
    .map((r) => {
      const date = new Date(`${r.on_date}T12:00:00+05:30`).toLocaleDateString('en-IN', { timeZone: RESTAURANT_TZ, weekday: 'short', day: 'numeric', month: 'long' });
      return { date, label: r.label || '', time: r.is_closed ? 'Closed' : `${to12h(r.opens)} – ${to12h(r.closes)}`, closed: Boolean(r.is_closed) };
    });
}

// Temporary closure notice. Shown while "active" is on and the optional end time has not passed.
export function closureShown(closure, now = Date.now()) {
  if (!closure || !closure.active || !String(closure.text || '').trim()) return false;
  if (!closure.until) return true;
  const until = Date.parse(closure.until);
  return Number.isNaN(until) || now < until;
}
