import { useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Button, Card, LoadState, Pill, TextInput, errorText, useConfirm, useLoad, useToast } from '../ui';

// Review moderation. Every action runs through Supabase Row Level Security, which only allows administrators
// (rows in the "admins" table). Hiding these buttons from visitors is not the protection; the database is.
//
// Statuses:  pending (new)  ->  approved (public)  |  hidden (taken off the website, kept)  |  rejected (spam / inappropriate)
// The website shows APPROVED reviews only.
const TABS = [
  ['pending', 'Pending'],
  ['approved', 'Approved'],
  ['hidden', 'Hidden'],
  ['rejected', 'Rejected'],
  ['all', 'All'],
];
const TONE = { pending: 'warn', approved: 'ok', hidden: 'info', rejected: 'bad' };

const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
const when = (iso) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

async function loadReviews() {
  const { data, error } = await supabase
    .from('reviews')
    .select('id, name, email, mobile, rating, message, status, created_at, reviewed_at')
    .order('created_at', { ascending: false })
    .limit(2000);
  if (error) throw error;
  return data;
}

export default function ReviewsPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState('pending');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState(null);
  const { loading, error, data, reload } = useLoad(loadReviews, []);

  const setStatus = async (review, status, doneText) => {
    setBusyId(review.id);
    const { error: e } = await supabase.from('reviews').update({ status }).eq('id', review.id);
    setBusyId(null);
    if (e) return toast.error(`Not changed. ${errorText(e)}`);
    toast.success(doneText);
    reload();
  };

  const remove = async (review) => {
    const ok = await confirm({
      title: 'Delete this review?',
      message: `The review from ${review.name} will be deleted permanently and cannot be recovered. To keep it but remove it from the website, use Hide instead.`,
      confirmLabel: 'Delete permanently',
    });
    if (!ok) return;
    setBusyId(review.id);
    const { error: e } = await supabase.from('reviews').delete().eq('id', review.id);
    setBusyId(null);
    if (e) return toast.error(`Not deleted. ${errorText(e)}`);
    toast.success('Review deleted.');
    reload();
  };

  const all = data || [];
  const stats = useMemo(() => {
    const approved = all.filter((r) => r.status === 'approved');
    const average = approved.length ? approved.reduce((sum, r) => sum + r.rating, 0) / approved.length : null;
    return { total: all.length, approved: approved.length, average };
  }, [all]);

  const count = (key) => (key === 'all' ? all.length : all.filter((r) => r.status === key).length);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((r) => (tab === 'all' || r.status === tab) && (!q || [r.name, r.message, r.email, r.mobile].some((v) => (v || '').toLowerCase().includes(q))));
  }, [all, tab, query]);

  return (
    <>
      <div className="a-pagehead">
        <div>
          <h1>Customer reviews</h1>
          <p>New reviews wait here as Pending. Only Approved reviews appear on the website. Email addresses and phone numbers are shown here for administration only and are never public.</p>
        </div>
      </div>

      <div className="a-stats">
        <div className="a-stat"><strong>{stats.total}</strong><span>Total reviews</span></div>
        <div className="a-stat"><strong>{stats.average === null ? '–' : stats.average.toFixed(1)}</strong><span>Average rating ({stats.approved} approved)</span></div>
        <div className="a-stat"><strong>{count('pending')}</strong><span>Waiting for approval</span></div>
      </div>

      <div className="a-toolbar">
        <div className="a-tabs" role="tablist" aria-label="Review status">
          {TABS.map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? 'is-on' : ''} onClick={() => setTab(key)}>
              {label} ({count(key)})
            </button>
          ))}
        </div>
        <TextInput type="search" placeholder="Search name, review or email…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search reviews" />
        <Button variant="ghost" small onClick={reload}>Refresh</Button>
      </div>

      <LoadState loading={loading} error={error} onRetry={reload}>
        {shown.length === 0 ? (
          <Card><p className="a-hint">No {tab === 'all' ? '' : `${tab} `}reviews{query ? ' match your search' : ''}.</p></Card>
        ) : (
          shown.map((review) => {
            const busy = busyId === review.id;
            return (
              <Card key={review.id} title={`${review.name}  ${stars(review.rating)}`} actions={<Pill tone={TONE[review.status]}>{review.status}</Pill>}>
                <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: '0 0 12px' }}>{review.message}</p>
                <p className="a-hint" style={{ overflowWrap: 'anywhere' }}>
                  {review.email && <>Email: {review.email}<br /></>}
                  {review.mobile && <>Phone: {review.mobile}<br /></>}
                  Sent {when(review.created_at)}
                  {review.reviewed_at && review.status !== 'pending' ? ` · Last decision ${when(review.reviewed_at)}` : ''}
                </p>
                <div className="a-actions">
                  {review.status === 'pending' && (
                    <>
                      <Button small busy={busy} onClick={() => setStatus(review, 'approved', 'Review approved. It is now on the website.')}>Approve</Button>
                      <Button small variant="ghost" busy={busy} onClick={() => setStatus(review, 'rejected', 'Review rejected. It will not be shown.')}>Reject</Button>
                    </>
                  )}
                  {review.status === 'approved' && (
                    <>
                      <Button small variant="ghost" busy={busy} onClick={() => setStatus(review, 'hidden', 'Review hidden. It is no longer on the website but is kept here.')}>Hide</Button>
                      <Button small variant="ghost" busy={busy} onClick={() => setStatus(review, 'rejected', 'Review rejected and removed from the website.')}>Reject</Button>
                    </>
                  )}
                  {review.status === 'hidden' && (
                    <>
                      <Button small busy={busy} onClick={() => setStatus(review, 'approved', 'Review restored. It is on the website again.')}>Restore</Button>
                      <Button small variant="ghost" busy={busy} onClick={() => setStatus(review, 'rejected', 'Review rejected.')}>Reject</Button>
                    </>
                  )}
                  {review.status === 'rejected' && (
                    <>
                      <Button small busy={busy} onClick={() => setStatus(review, 'approved', 'Review approved. It is now on the website.')}>Approve</Button>
                      <Button small variant="ghost" busy={busy} onClick={() => setStatus(review, 'pending', 'Review moved back to Pending.')}>Move to pending</Button>
                    </>
                  )}
                  <Button small variant="danger" busy={busy} onClick={() => remove(review)}>Delete</Button>
                </div>
              </Card>
            );
          })
        )}
      </LoadState>
    </>
  );
}
