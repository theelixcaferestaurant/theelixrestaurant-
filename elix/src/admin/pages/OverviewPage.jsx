import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { isRowUnavailable } from '../../lib/availability';
import { Card, LoadState, Pill, useLoad } from '../ui';

// Every number on this page is counted from the live database when the page opens. Nothing is typed in by hand.
async function loadOverview() {
  const [menu, reviews, activity] = await Promise.all([
    supabase.from('menu_items').select('id, available, availability, unavailable_until, available_from, available_to'),
    supabase.from('reviews').select('id, name, rating, message, status, created_at').order('created_at', { ascending: false }).limit(5000),
    supabase.from('admin_activity').select('id, admin_email, summary, created_at').order('created_at', { ascending: false }).limit(8),
  ]);
  if (menu.error) throw menu.error;
  if (reviews.error) throw reviews.error;
  // admin_activity exists after migration 0009; show a hint instead of failing the whole page.
  return { menu: menu.data, reviews: reviews.data, activity: activity.error ? null : activity.data };
}

const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
const when = (iso) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const TONE = { pending: 'warn', approved: 'ok', hidden: 'info', rejected: 'bad' };

function Stat({ value, label, to }) {
  const body = (
    <div className="a-stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
  return to ? <Link to={to} style={{ textDecoration: 'none', color: 'inherit' }}>{body}</Link> : body;
}

export default function OverviewPage() {
  const { loading, error, data, reload } = useLoad(loadOverview);
  return (
    <>
      <div className="a-pagehead">
        <div>
          <h1>Overview</h1>
          <p>A live summary of your menu and customer reviews.</p>
        </div>
      </div>
      <LoadState loading={loading} error={error} onRetry={reload}>
        {data && (() => {
          const now = Date.now();
          const listed = data.menu.filter((m) => m.available);
          const unavailable = listed.filter((m) => isRowUnavailable(m, now)).length;
          const count = (status) => data.reviews.filter((r) => r.status === status).length;
          const approved = data.reviews.filter((r) => r.status === 'approved');
          const average = approved.length ? (approved.reduce((sum, r) => sum + r.rating, 0) / approved.length).toFixed(1) : '–';
          return (
            <>
              <div className="a-stats">
                <Stat value={data.menu.length} label="Total menu items" to="/admin/menu" />
                <Stat value={listed.length - unavailable} label="Available now" to="/admin/menu" />
                <Stat value={unavailable} label="Temporarily unavailable" to="/admin/menu" />
                <Stat value={data.menu.length - listed.length} label="Hidden from website" to="/admin/menu" />
                <Stat value={data.reviews.length} label="Total reviews" to="/admin/reviews" />
                <Stat value={count('pending')} label="Pending reviews" to="/admin/reviews" />
                <Stat value={count('approved')} label="Approved reviews" to="/admin/reviews" />
                <Stat value={count('hidden')} label="Hidden reviews" to="/admin/reviews" />
                <Stat value={average} label="Average rating (approved)" to="/admin/reviews" />
              </div>

              <div className="a-two">
                <Card title="Recent customer reviews" actions={<Link className="a-link" to="/admin/reviews">All reviews</Link>}>
                  {data.reviews.length === 0 ? (
                    <p className="a-hint">No reviews yet.</p>
                  ) : (
                    <ul className="a-feed">
                      {data.reviews.slice(0, 5).map((r) => (
                        <li key={r.id}>
                          <strong>{r.name}</strong> {stars(r.rating)} <Pill tone={TONE[r.status]}>{r.status}</Pill>
                          <br />
                          {r.message.length > 120 ? `${r.message.slice(0, 120)}…` : r.message}
                          <small>{when(r.created_at)}</small>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>

                <Card title="Recent admin activity">
                  {data.activity === null ? (
                    <p className="a-hint">The activity log is not set up yet. Run migration 0009_dashboard.sql in the Supabase SQL Editor.</p>
                  ) : data.activity.length === 0 ? (
                    <p className="a-hint">Nothing yet. Changes you make in the dashboard will be listed here.</p>
                  ) : (
                    <ul className="a-feed">
                      {data.activity.map((a) => (
                        <li key={a.id}>
                          {a.summary}
                          <small>{when(a.created_at)}{a.admin_email ? ` · ${a.admin_email}` : ''}</small>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>
            </>
          );
        })()}
      </LoadState>
    </>
  );
}
