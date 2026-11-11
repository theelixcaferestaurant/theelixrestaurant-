import { OPENING_HOURS } from '../data/siteData';
import { upcomingSpecialHours } from '../lib/hours';

// Opening hours from the dashboard (weekly hours + holiday hours). variant: "footer" or "contact" (existing styles).
export default function OpeningHours({ variant = 'footer' }) {
  const lines = OPENING_HOURS.lines && OPENING_HOURS.lines.length ? OPENING_HOURS.lines : [{ days: OPENING_HOURS.days, time: OPENING_HOURS.time }];
  const special = upcomingSpecialHours(OPENING_HOURS.special);
  const timeClass = variant === 'footer' ? 'footer-hours-time' : 'hours-time';
  const noteClass = variant === 'footer' ? 'footer-hours-note' : 'hours-note';
  const body = (
    <>
      {lines.map((line) => (
        <div key={line.days} className="hours-line">
          <p className={timeClass}>{line.time}</p>
          <p className={variant === 'footer' ? undefined : 'hours-days'}>{line.days}</p>
        </div>
      ))}
      {OPENING_HOURS.note && <p className={noteClass}>{OPENING_HOURS.note}</p>}
      {special.length > 0 && (
        <ul className="hours-special" aria-label="Special hours">
          {special.map((day) => (
            <li key={day.date} className={day.closed ? 'is-closed' : ''}>
              <strong>{day.date}</strong>
              {day.label ? ` · ${day.label}` : ''}: {day.time}
            </li>
          ))}
        </ul>
      )}
    </>
  );
  return variant === 'footer' ? body : <div className="hours-block">{body}</div>;
}
