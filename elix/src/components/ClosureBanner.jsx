import { useState } from 'react';
import { X } from 'lucide-react';
import { CLOSURE } from '../data/siteData';
import { closureShown } from '../lib/hours';

// Temporary closure notice set in the dashboard. Appears under the header on every page while it is switched on.
export default function ClosureBanner() {
  const [dismissed, setDismissed] = useState('');
  if (!closureShown(CLOSURE) || dismissed === CLOSURE.text) return null;
  return (
    <div className="closure-banner" role="status">
      <p>{CLOSURE.text}</p>
      <button type="button" className="closure-close" onClick={() => setDismissed(CLOSURE.text)} aria-label="Dismiss notice">
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
