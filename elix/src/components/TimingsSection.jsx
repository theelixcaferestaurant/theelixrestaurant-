import { OPENING_HOURS } from '../data/siteData';
import { DAILY_TIMINGS, TIMINGS_DAYS, formatTiming } from '../data/timings';

// The dedicated DAILY TIMINGS section, placed at the bottom of every page, just above the footer.
// The drawer's "Timings" link scrolls here (id="timings").
export default function TimingsSection() {
  return (
    <section id="timings" className="timings" tabIndex={-1} aria-labelledby="timings-title">
      <div className="container timings-inner">
        <span className="eyebrow">{TIMINGS_DAYS}</span>
        <h2 id="timings-title" className="timings-title">
          Daily Timings
        </h2>
        <p className="timings-lead muted">
          {OPENING_HOURS.uniformOpen ? 'Our timings are the same all seven days, Monday to Sunday.' : 'These timings apply on the days we are open. See opening hours below for any closed days.'}
        </p>

        <ul className="timings-list">
          {DAILY_TIMINGS.map((item) => (
            <li key={item.key} className="timings-row">
              <span className="timings-name">{item.label}</span>
              <span className="timings-hours">{formatTiming(item)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
