import { setEditMode, useEditState } from '../lib/localMedia';

// Small floating switch: shows or hides the "Add image / Add video" buttons on every picture slot.
// It exists only in the admin preview (Dashboard > View website) and is never rendered for public visitors.
export default function EditBar() {
  const { allowed, on, status } = useEditState();
  if (!allowed) return null;
  return (
    <div className="edit-bar" role="region" aria-label="Photo and video editing">
      <button type="button" onClick={() => setEditMode(!on)} aria-pressed={on}>
        {on ? 'Hide add-photo buttons' : 'Show add-photo buttons'}
      </button>
      {status && (
        <span className="edit-bar-status" role="status">
          {status}
        </span>
      )}
    </div>
  );
}
