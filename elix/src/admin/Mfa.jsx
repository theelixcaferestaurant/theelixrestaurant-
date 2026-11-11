import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Button, Card, Field, Spinner, TextInput, errorText, useConfirm, useToast } from './ui';

// ---------------------------------------------------------------------------------------------
// Two-step sign in (Supabase multi-factor authentication).
//   Step 1: email + password (done in AdminApp.jsx)
//   Step 2: a 6-digit code from an authenticator app (free) or an SMS to your phone
// A session that has not passed step 2 is "aal1". Only "aal2" sessions open the dashboard, and the
// database function public.is_admin() can be set to require aal2 as well (supabase/enforce_two_step_login.sql).
// ---------------------------------------------------------------------------------------------

// Accepts 98765 43210, 9876543210, 919876543210 or +91 98765 43210 (or another +country number).
export function normalisePhone(raw) {
  const compact = String(raw || '').replace(/[\s\-().]/g, '');
  if (/^[6-9][0-9]{9}$/.test(compact)) return `+91${compact}`;
  if (/^91[6-9][0-9]{9}$/.test(compact)) return `+${compact}`;
  if (/^\+[1-9][0-9]{7,14}$/.test(compact)) return compact;
  return null;
}

const maskPhone = (phone) => (phone ? `${phone.slice(0, 3)}••••${phone.slice(-3)}` : 'your phone');
const stamp = () => Date.now().toString(36);
const factorLabel = (f) => (f.factor_type === 'phone' ? `SMS to ${maskPhone(f.phone)}` : 'Authenticator app');

async function removeUnfinishedFactors() {
  const { data } = await supabase.auth.mfa.listFactors();
  const stale = ((data && data.all) || []).filter((f) => f.status === 'unverified');
  for (const f of stale) await supabase.auth.mfa.unenroll({ factorId: f.id });
}

async function listVerifiedFactors() {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  return (data.all || []).filter((f) => f.status === 'verified');
}

function CodeField({ value, onChange, label = 'Enter the 6-digit code' }) {
  return (
    <Field label={label}>
      <TextInput
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={6}
        placeholder="123456"
        autoFocus
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
      />
    </Field>
  );
}

function Screen({ title, hint, children }) {
  return (
    <div className="a-login">
      <div className="a-login-card">
        <h1>{title}</h1>
        {hint && <p className="a-hint">{hint}</p>}
        {children}
      </div>
    </div>
  );
}

// ---------- login step 2: ask for the code ----------
export function MfaChallenge({ onDone }) {
  const [factors, setFactors] = useState(null);
  const [factorId, setFactorId] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    listVerifiedFactors()
      .then((list) => {
        if (!live) return;
        setFactors(list);
        const first = list.find((f) => f.factor_type === 'totp') || list[0];
        setFactorId(first ? first.id : '');
      })
      .catch((e) => live && (setFactors([]), setError(errorText(e))));
    return () => {
      live = false;
    };
  }, []);

  const factor = factors && factors.find((f) => f.id === factorId);
  const isPhone = factor && factor.factor_type === 'phone';

  const pick = (id) => {
    setFactorId(id);
    setChallengeId('');
    setCode('');
    setError('');
  };

  const sendSms = async () => {
    setBusy(true);
    setError('');
    const { data, error: e } = await supabase.auth.mfa.challenge({ factorId });
    setBusy(false);
    if (e) return setError(errorText(e));
    setChallengeId(data.id);
    setCode('');
  };

  const verify = async (event) => {
    event.preventDefault();
    if (code.length !== 6) return setError('Enter the 6-digit code.');
    setBusy(true);
    setError('');
    const { error: e } = isPhone
      ? await supabase.auth.mfa.verify({ factorId, challengeId, code })
      : await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    setBusy(false);
    if (e) {
      setCode('');
      return setError(/invalid|expired|incorrect/i.test(e.message) ? 'That code is wrong or has expired. Please try again.' : errorText(e));
    }
    onDone();
  };

  const signOut = () => supabase.auth.signOut();

  if (factors === null) return <Screen title="Step 2 of 2"><div className="a-center"><Spinner /> Loading…</div></Screen>;

  if (!factors.length) {
    return (
      <Screen title="Step 2 of 2">
        {error && <div className="a-alert is-error" role="alert">{error}</div>}
        <p>No verification method was found for this account.</p>
        <Button onClick={onDone}>Set one up</Button>
        <button type="button" className="a-link" onClick={signOut}>Sign out</button>
      </Screen>
    );
  }

  return (
    <Screen title="Step 2 of 2" hint="Confirm it is really you.">
      {factors.length > 1 && (
        <div className="a-tabs" style={{ justifyContent: 'center' }}>
          {factors.map((f) => (
            <button key={f.id} type="button" className={f.id === factorId ? 'is-on' : ''} onClick={() => pick(f.id)}>{factorLabel(f)}</button>
          ))}
        </div>
      )}

      {isPhone && !challengeId ? (
        <div className="a-form">
          <p>We will text a 6-digit code to <strong>{maskPhone(factor.phone)}</strong>.</p>
          {error && <div className="a-alert is-error" role="alert">{error}</div>}
          <Button busy={busy} onClick={sendSms}>Send code</Button>
        </div>
      ) : (
        <form onSubmit={verify} className="a-form">
          <p className="a-hint" style={{ margin: 0 }}>
            {isPhone ? `Enter the code we texted to ${maskPhone(factor.phone)}.` : 'Open your authenticator app and enter the current 6-digit code for The Elix.'}
          </p>
          <CodeField value={code} onChange={setCode} />
          {error && <div className="a-alert is-error" role="alert">{error}</div>}
          <button type="submit" className="a-btn a-btn-primary" disabled={busy || code.length !== 6}>{busy && <Spinner label="Checking" />}Verify and open dashboard</button>
          {isPhone && <button type="button" className="a-link" onClick={sendSms} disabled={busy}>Send a new code</button>}
        </form>
      )}
      <button type="button" className="a-link" onClick={signOut}>Cancel and sign out</button>
    </Screen>
  );
}

// ---------- add a method: authenticator app or SMS ----------
export function EnrollPanel({ onDone, onCancel }) {
  const [method, setMethod] = useState('totp');
  const [step, setStep] = useState('start'); // start | code
  const [factorId, setFactorId] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [qr, setQr] = useState('');
  const [secret, setSecret] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const choose = (next) => {
    setMethod(next);
    setStep('start');
    setCode('');
    setError('');
  };

  const begin = async () => {
    setBusy(true);
    setError('');
    try {
      await removeUnfinishedFactors();
      if (method === 'totp') {
        const { data, error: e } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Authenticator ${stamp()}`, issuer: 'The Elix Dashboard' });
        if (e) throw e;
        setFactorId(data.id);
        setQr(data.totp.qr_code);
        setSecret(data.totp.secret);
      } else {
        const number = normalisePhone(phone);
        if (!number) throw new Error('Enter a valid mobile number, for example 98765 43210 or +91 98765 43210.');
        const { data, error: e } = await supabase.auth.mfa.enroll({ factorType: 'phone', friendlyName: `Phone ${stamp()}`, phone: number });
        if (e) throw e;
        const challenge = await supabase.auth.mfa.challenge({ factorId: data.id });
        if (challenge.error) throw challenge.error;
        setFactorId(data.id);
        setChallengeId(challenge.data.id);
      }
      setStep('code');
    } catch (e) {
      setError(errorText(e));
    }
    setBusy(false);
  };

  const resend = async () => {
    setBusy(true);
    setError('');
    const { data, error: e } = await supabase.auth.mfa.challenge({ factorId });
    setBusy(false);
    if (e) return setError(errorText(e));
    setChallengeId(data.id);
    setCode('');
  };

  const finish = async (event) => {
    event.preventDefault();
    if (code.length !== 6) return setError('Enter the 6-digit code.');
    setBusy(true);
    setError('');
    const { error: e } = method === 'totp'
      ? await supabase.auth.mfa.challengeAndVerify({ factorId, code })
      : await supabase.auth.mfa.verify({ factorId, challengeId, code });
    setBusy(false);
    if (e) {
      setCode('');
      return setError(/invalid|expired|incorrect/i.test(e.message) ? 'That code is wrong or has expired. Please try again.' : errorText(e));
    }
    onDone();
  };

  const cancel = async () => {
    try {
      await removeUnfinishedFactors();
    } catch {
      /* nothing to clean up */
    }
    if (onCancel) onCancel();
  };

  return (
    <div className="a-form">
      <div className="a-tabs" style={{ justifyContent: 'center' }}>
        <button type="button" className={method === 'totp' ? 'is-on' : ''} onClick={() => choose('totp')}>Authenticator app (free)</button>
        <button type="button" className={method === 'phone' ? 'is-on' : ''} onClick={() => choose('phone')}>SMS to my phone</button>
      </div>

      {step === 'start' && method === 'totp' && (
        <>
          <p className="a-hint" style={{ margin: 0 }}>Use Google Authenticator, Microsoft Authenticator, Authy or any similar app. Works without internet or SMS.</p>
          <Button busy={busy} onClick={begin}>Show QR code</Button>
        </>
      )}

      {step === 'start' && method === 'phone' && (
        <>
          <Field label="Your mobile number" hint="Indian numbers can be typed without +91.">
            <TextInput type="tel" inputMode="tel" autoComplete="tel" placeholder="98765 43210" value={phone} onChange={(event) => setPhone(event.target.value)} />
          </Field>
          <p className="a-hint" style={{ margin: 0 }}>Needs an SMS provider connected in Supabase. See TWO-STEP-LOGIN.md.</p>
          <Button busy={busy} onClick={begin}>Send code</Button>
        </>
      )}

      {step === 'code' && (
        <form onSubmit={finish} className="a-form">
          {method === 'totp' ? (
            <>
              <p style={{ margin: 0 }}>1. Scan this QR code with your authenticator app.</p>
              <img className="a-qr" src={qr} alt="QR code for your authenticator app" width="180" height="180" />
              <p className="a-hint" style={{ margin: 0, overflowWrap: 'anywhere' }}>Cannot scan? Enter this key by hand: <code>{secret}</code></p>
              <p style={{ margin: 0 }}>2. Enter the 6-digit code the app shows.</p>
            </>
          ) : (
            <p style={{ margin: 0 }}>We texted a 6-digit code to <strong>{maskPhone(normalisePhone(phone))}</strong>.</p>
          )}
          <CodeField value={code} onChange={setCode} />
          <button type="submit" className="a-btn a-btn-primary" disabled={busy || code.length !== 6}>{busy && <Spinner label="Checking" />}Confirm</button>
          {method === 'phone' && <button type="button" className="a-link" onClick={resend} disabled={busy}>Send a new code</button>}
        </form>
      )}

      {error && <div className="a-alert is-error" role="alert">{error}</div>}
      {onCancel && <button type="button" className="a-link" onClick={cancel}>Cancel</button>}
    </div>
  );
}

// ---------- first login: you must finish setup before the dashboard opens ----------
export function MfaSetupScreen({ onDone }) {
  return (
    <Screen title="Set up two-step sign in" hint="Step 2 of 2. Done once. After this, a password alone can never open the dashboard.">
      <EnrollPanel onDone={onDone} />
      <button type="button" className="a-link" onClick={() => supabase.auth.signOut()}>Sign out</button>
    </Screen>
  );
}

// ---------- Admin account page: see, add and remove methods ----------
export function MfaCard() {
  const toast = useToast();
  const confirm = useConfirm();
  const [factors, setFactors] = useState(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    listVerifiedFactors().then(setFactors).catch((e) => setError(errorText(e)));
  }, []);
  useEffect(load, [load]);

  const remove = async (factor) => {
    if (factors.length <= 1) return toast.error('Keep at least one method. Add a second one first, then remove this one.');
    const ok = await confirm({ title: 'Remove this method?', message: `${factorLabel(factor)} will no longer work for signing in.`, confirmLabel: 'Remove' });
    if (!ok) return;
    const { error: e } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    if (e) return toast.error(errorText(e));
    toast.success('Method removed.');
    load();
  };

  return (
    <Card title="Two-step sign in" actions={!adding && factors && <Button small variant="ghost" onClick={() => setAdding(true)}>Add a method</Button>}>
      {error && <div className="a-alert is-error" role="alert">{error}</div>}
      {factors === null && !error && <div className="a-center"><Spinner /> Loading…</div>}
      {factors && (
        <>
          <p className="a-hint">Signing in needs your password and a code from one of these. Keep two methods so you are never locked out.</p>
          <div className="a-list">
            {factors.map((f) => (
              <div key={f.id} className="a-row">
                <div className="a-row-main"><strong>{factorLabel(f)}</strong></div>
                <div className="a-row-actions"><Button small variant="danger" onClick={() => remove(f)}>Remove</Button></div>
              </div>
            ))}
          </div>
        </>
      )}
      {adding && (
        <div style={{ marginTop: 16 }}>
          <EnrollPanel
            onCancel={() => setAdding(false)}
            onDone={() => {
              setAdding(false);
              toast.success('Method added.');
              load();
            }}
          />
        </div>
      )}
    </Card>
  );
}
