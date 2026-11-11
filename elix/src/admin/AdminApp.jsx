import { useCallback, useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { Button, ConfirmProvider, Spinner, TextInput, ToastProvider, Field, errorText, useToast } from './ui';
import MenuPage from './pages/MenuPage';
import TakeawayPage from './pages/TakeawayPage';
import CategoriesPage from './pages/CategoriesPage';
import GalleryPage from './pages/GalleryPage';
import RestaurantPage from './pages/RestaurantPage';
import HomepagePage from './pages/HomepagePage';
import ReviewsPage from './pages/ReviewsPage';
import OverviewPage from './pages/OverviewPage';
import MediaPage from './pages/MediaPage';
import HoursPage from './pages/HoursPage';
import AccountPage from './pages/AccountPage';
import BackupPage from './pages/BackupPage';
import { MfaChallenge, MfaSetupScreen } from './Mfa';
import './admin.css';

// ---------- authentication ----------
// status: loading | out (signed out) | denied (signed in but not an administrator) | recovery
//         | mfa-setup (administrator, no second step set up yet) | mfa-challenge (second step required) | error | admin
// The dashboard opens only when the session is "aal2": password AND a verified second step.
function useAuth() {
  const [auth, setAuth] = useState({ status: 'loading', user: null });

  const evaluate = useCallback(async (session) => {
    if (!session) return setAuth({ status: 'out', user: null });
    const { data, error } = await supabase.from('admins').select('user_id').eq('user_id', session.user.id).maybeSingle();
    if (error || !data) return setAuth({ status: 'denied', user: session.user });
    // Second step. If it cannot be checked, the dashboard stays closed.
    const { data: level, error: levelError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (levelError || !level) return setAuth({ status: 'error', user: session.user });
    if (level.currentLevel === 'aal2') return setAuth({ status: 'admin', user: session.user });
    setAuth({ status: level.nextLevel === 'aal2' ? 'mfa-challenge' : 'mfa-setup', user: session.user });
  }, []);

  useEffect(() => {
    if (!supabase) return undefined;
    supabase.auth.getSession().then(({ data }) => evaluate(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // never call the database directly inside this callback: defer it
      setTimeout(() => (event === 'PASSWORD_RECOVERY' ? setAuth({ status: 'recovery', user: session?.user ?? null }) : evaluate(session)), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [evaluate]);

  const refresh = useCallback(() => supabase.auth.getSession().then(({ data }) => evaluate(data.session)), [evaluate]);
  return { ...auth, refresh };
}

function Center({ children }) {
  return <div className="a-login"><div className="a-login-card">{children}</div></div>;
}

function SetupNotice() {
  return (
    <Center>
      <h1>Dashboard not connected</h1>
      <p>This website has no Supabase connection yet. To turn the dashboard on:</p>
      <ol className="a-steps">
        <li>Copy <code>.env.example</code> to <code>.env</code>.</li>
        <li>Fill in <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> from your Supabase project.</li>
        <li>Restart <code>npm run dev</code> (or rebuild and redeploy).</li>
      </ol>
      <p className="a-hint">Full steps are in README-BACKEND.md.</p>
    </Center>
  );
}

function LoginForm() {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    const { error: e } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (e) setError(/invalid login/i.test(e.message) ? 'Incorrect email or password.' : errorText(e));
    setBusy(false);
  };

  const reset = async () => {
    if (!email.trim()) return setError('Enter your email address first, then choose “Forgot password”.');
    const { error: e } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/admin` });
    if (e) setError(errorText(e));
    else toast.success('If that email belongs to an administrator, a reset link has been sent.');
  };

  return (
    <Center>
      <h1>The Elix Dashboard</h1>
      <p className="a-hint">Administrator sign in · Step 1 of 2: email and password</p>
      <form onSubmit={submit} className="a-form">
        <Field label="Email"><TextInput type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Password"><TextInput type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        {error && <div className="a-alert is-error" role="alert">{error}</div>}
        <button type="submit" className="a-btn a-btn-primary" disabled={busy}>{busy && <Spinner label="Signing in" />}Sign in</button>
        <button type="button" className="a-link" onClick={reset}>Forgot password?</button>
      </form>
      <a className="a-link" href="/">← Back to the website</a>
    </Center>
  );
}

function RecoveryForm() {
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    if (password.length < 10) return toast.error('Use at least 10 characters.');
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error(errorText(error));
    toast.success('Password updated.');
    window.location.assign('/admin');
  };
  return (
    <Center>
      <h1>Choose a new password</h1>
      <form onSubmit={submit} className="a-form">
        <Field label="New password" hint="At least 10 characters."><TextInput type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <button type="submit" className="a-btn a-btn-primary" disabled={busy}>{busy && <Spinner />}Save password</button>
      </form>
    </Center>
  );
}

function Denied({ user }) {
  return (
    <Center>
      <h1>Access denied</h1>
      <p>You are signed in as <strong>{user?.email}</strong>, but this account is not an administrator of The Elix.</p>
      <Button onClick={() => supabase.auth.signOut()}>Sign out</Button>
    </Center>
  );
}

// ---------- dashboard shell ----------
const NAV = [
  ['/admin', 'Overview', true],
  ['/admin/menu', 'Menu management'],
  ['/admin/takeaway', 'Take Away slides'],
  ['/admin/categories', 'Categories'],
  ['/admin/reviews', 'Reviews'],
  ['/admin/media', 'Website media'],
  ['/admin/gallery', 'Gallery'],
  ['/admin/homepage', 'Website content'],
  ['/admin/restaurant', 'Restaurant details'],
  ['/admin/hours', 'Opening hours'],
  ['/admin/backup', 'Backup & recovery'],
  ['/admin/account', 'Admin account'],
];

function Shell({ user }) {
  // An automatic restore point at most once a day, taken when the administrator opens the dashboard.
  // Silent: if migration 0011 has not been run yet, nothing happens.
  useEffect(() => {
    supabase.rpc('ensure_daily_content_backup').then(({ error }) => error && console.info('Daily backup skipped:', error.message));
  }, []);
  return (
    <div className="a-shell">
      <aside className="a-side">
        <div className="a-brand">THE ELIX <small>Dashboard</small></div>
        <nav aria-label="Dashboard">
          {NAV.map(([to, label, end]) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'is-on' : '')}>{label}</NavLink>
          ))}
        </nav>
        <div className="a-side-foot">
          <a href="/?adminPreview=1" target="_blank" rel="noopener noreferrer">View website ↗</a>
          <span title={user.email}>{user.email}</span>
          <button type="button" className="a-link" onClick={() => supabase.auth.signOut()}>Log out</button>
        </div>
      </aside>
      <main className="a-main">
        <Routes>
          <Route path="/admin" element={<OverviewPage />} />
          <Route path="/admin/menu" element={<MenuPage />} />
          <Route path="/admin/takeaway" element={<TakeawayPage />} />
          <Route path="/admin/media" element={<MediaPage />} />
          <Route path="/admin/hours" element={<HoursPage />} />
          <Route path="/admin/backup" element={<BackupPage />} />
          <Route path="/admin/account" element={<AccountPage user={user} />} />
          <Route path="/admin/categories" element={<CategoriesPage />} />
          <Route path="/admin/gallery" element={<GalleryPage />} />
          <Route path="/admin/reviews" element={<ReviewsPage />} />
          <Route path="/admin/restaurant" element={<RestaurantPage />} />
          <Route path="/admin/homepage" element={<HomepagePage />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function Gate() {
  const auth = useAuth();
  if (auth.status === 'loading') return <Center><div className="a-center"><Spinner /> Checking sign in…</div></Center>;
  if (auth.status === 'recovery') return <RecoveryForm />;
  if (auth.status === 'out') return <LoginForm />;
  if (auth.status === 'denied') return <Denied user={auth.user} />;
  if (auth.status === 'mfa-challenge') return <MfaChallenge onDone={auth.refresh} />;
  if (auth.status === 'mfa-setup') return <MfaSetupScreen onDone={auth.refresh} />;
  if (auth.status === 'error') {
    return (
      <Center>
        <h1>Could not check your sign in</h1>
        <p>Check your internet connection and try again.</p>
        <Button onClick={auth.refresh}>Try again</Button>
        <Button variant="ghost" onClick={() => supabase.auth.signOut()}>Sign out</Button>
      </Center>
    );
  }
  return <Shell user={auth.user} />;
}

export default function AdminApp() {
  useEffect(() => {
    const previous = document.title;
    document.title = 'Dashboard | The Elix';
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => {
      document.title = previous;
      meta.remove();
    };
  }, []);

  return (
    <div className="admin">
      <ToastProvider><ConfirmProvider>{isSupabaseConfigured ? <Gate /> : <SetupNotice />}</ConfirmProvider></ToastProvider>
    </div>
  );
}
