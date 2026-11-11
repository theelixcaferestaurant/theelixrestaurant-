import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

// ---------- toasts (success / error messages) ----------
const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);
  const push = useCallback((type, text) => {
    const id = (idRef.current += 1);
    setToasts((list) => [...list, { id, type, text }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), type === 'error' ? 8000 : 3500);
  }, []);
  const api = useCallback(
    Object.assign((type, text) => push(type, text), {
      success: (text) => push('success', text),
      error: (text) => push('error', text),
    }),
    [push]
  );
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="a-toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`a-toast is-${t.type}`}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// Turns a Supabase / network error into a short readable sentence.
export const errorText = (error) => {
  if (!error) return 'Something went wrong.';
  const message = error.message || String(error);
  if (/row-level security|permission denied|not authorized/i.test(message))
    return 'Not allowed: your account is not an administrator, or you are signed out.';
  if (/duplicate key/i.test(message)) return 'That already exists. Choose a different name or id.';
  if (/Failed to fetch|NetworkError|network/i.test(message)) return 'Network problem. Check your connection and try again.';
  return message;
};

// ---------- loading a list from the database ----------
export function useLoad(loader, deps = []) {
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    Promise.resolve()
      .then(loader)
      .then((data) => !cancelled && setState({ loading: false, error: null, data }))
      .catch((error) => !cancelled && setState({ loading: false, error, data: null }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { ...state, reload };
}

// ---------- small building blocks ----------
export const Spinner = ({ label = 'Loading' }) => (
  <span className="a-spinner" role="status" aria-label={label} />
);

export function LoadState({ loading, error, onRetry, children }) {
  if (loading) {
    return (
      <div className="a-center">
        <Spinner /> <span>Loading…</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="a-alert is-error">
        <strong>Could not load.</strong> {errorText(error)}{' '}
        {onRetry && (
          <button type="button" className="a-btn a-btn-small" onClick={onRetry}>
            Try again
          </button>
        )}
      </div>
    );
  }
  return children;
}

export function Button({ busy, children, variant = 'primary', small, ...rest }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={rest.disabled || busy}
      className={`a-btn a-btn-${variant} ${small ? 'a-btn-small' : ''} ${rest.className || ''}`}
    >
      {busy && <Spinner label="Saving" />}
      {children}
    </button>
  );
}

export function Field({ label, hint, children, wide }) {
  return (
    <label className={`a-field ${wide ? 'is-wide' : ''}`}>
      <span className="a-label">{label}</span>
      {children}
      {hint && <span className="a-hint">{hint}</span>}
    </label>
  );
}

export const TextInput = (props) => <input className="a-input" {...props} />;
export const TextArea = (props) => <textarea className="a-input" rows={3} {...props} />;
export const Select = ({ children, ...props }) => (
  <select className="a-input" {...props}>
    {children}
  </select>
);

export function Check({ label, checked, onChange, hint }) {
  return (
    <label className="a-check">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
    </label>
  );
}

export function Card({ title, actions, children }) {
  return (
    <section className="a-card">
      {(title || actions) && (
        <header className="a-card-head">
          <h2>{title}</h2>
          <div>{actions}</div>
        </header>
      )}
      {children}
    </section>
  );
}

export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="a-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="a-modal" role="dialog" aria-modal="true" aria-label={title}>
        <header className="a-modal-head">
          <h2>{title}</h2>
          <button type="button" className="a-icon" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="a-modal-body">{children}</div>
      </div>
    </div>
  );
}

export const slugify = (text) =>
  text
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

// ---------- confirmation dialog (replaces the browser's plain confirm box) ----------
// const confirm = useConfirm();  if (!(await confirm({ title, message, confirmLabel, danger }))) return;
const ConfirmContext = createContext(() => Promise.resolve(false));
export const useConfirm = () => useContext(ConfirmContext);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const ask = useCallback((options) => new Promise((resolve) => setState({ ...options, resolve })), []);
  const close = (answer) => {
    state.resolve(answer);
    setState(null);
  };
  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      {state && (
        <Modal title={state.title || 'Are you sure?'} onClose={() => close(false)}>
          <p style={{ margin: '0 0 16px', overflowWrap: 'anywhere' }}>{state.message}</p>
          <div className="a-actions">
            <Button variant={state.danger === false ? 'primary' : 'danger'} onClick={() => close(true)}>{state.confirmLabel || 'Yes, continue'}</Button>
            <Button variant="ghost" onClick={() => close(false)}>Cancel</Button>
          </div>
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}

export const Pill = ({ tone = 'muted', children }) => <span className={`a-pill is-${tone}`}>{children}</span>;
